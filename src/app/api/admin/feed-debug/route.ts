import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getPersonalizedFeed } from "@/lib/feed";
import { safeParseJson } from "@/lib/utils";
import {
  computeTrendingEntities,
  countPerCategory,
} from "@/lib/categories";

/**
 * Reproduces the /feed server component's data fetching stage by stage
 * and returns the FIRST step that throws, with the full error message,
 * stack, and context. Route handlers (unlike server components) are
 * not sanitized by Next.js in production — so we actually see the
 * error string.
 *
 * Usage:
 *   https://<app>.vercel.app/api/admin/feed-debug?token=<SEED_TOKEN>
 *   https://<app>.vercel.app/api/admin/feed-debug?token=<SEED_TOKEN>&category=politics
 *
 * Returns: { ok, failedAt, error?, steps: [...], summary? }
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type StepResult = {
  step: string;
  ok: boolean;
  info?: unknown;
  error?: { message: string; stack?: string; name: string };
};

async function run(req: Request): Promise<StepResult[]> {
  const url = new URL(req.url);
  const category = url.searchParams.get("category") || "top";
  const steps: StepResult[] = [];

  async function step<T>(name: string, fn: () => Promise<T>, describe?: (v: T) => unknown): Promise<T | undefined> {
    try {
      const v = await fn();
      steps.push({
        step: name,
        ok: true,
        info: describe ? describe(v) : undefined,
      });
      return v;
    } catch (err) {
      const e = err as Error;
      steps.push({
        step: name,
        ok: false,
        error: {
          message: e.message,
          name: e.name,
          stack: e.stack?.split("\n").slice(0, 10).join("\n"),
        },
      });
      return undefined;
    }
  }

  // 1. Raw Prisma connection + simple count
  await step("prisma.article.count", () => db.article.count(), (c) => ({ count: c }));

  // 2. Query the latest article with ALL columns (matches what getPersonalizedFeed does)
  await step(
    "prisma.article.findFirst (full row)",
    () =>
      db.article.findFirst({
        include: { source: true, topicCluster: true },
        orderBy: { publishedAt: "desc" },
      }),
    (a) =>
      a
        ? {
            id: a.id,
            headline: a.headline.slice(0, 80),
            hasSource: !!a.source,
            hasImageUrl: !!a.imageUrl,
            columns: Object.keys(a),
          }
        : null,
  );

  // 3. The exact findMany getPersonalizedFeed runs (without the user filter)
  const articlesRaw = await step(
    "prisma.article.findMany (feed query shape)",
    () =>
      db.article.findMany({
        include: { source: true, topicCluster: true },
        orderBy: { publishedAt: "desc" },
        take: 200,
      }),
    (a) => ({ count: a.length }),
  );

  // 4. Current user (feed page won't render without one)
  const user = await step("getCurrentUser", () => getCurrentUser(), (u) =>
    u ? { id: u.id, email: u.email } : null,
  );

  // 5. Full getPersonalizedFeed call with the optional category
  if (user) {
    await step(
      `getPersonalizedFeed(category=${category})`,
      () =>
        getPersonalizedFeed(user.id, {
          limit: 40,
          category,
        }),
      (a) => ({ count: a.length, firstHeadline: a[0]?.headline.slice(0, 80) }),
    );
  }

  // 6. Stats — what the feed page computes after fetching articles
  if (articlesRaw && articlesRaw.length > 0) {
    await step(
      "countPerCategory + computeTrendingEntities",
      async () => {
        const normalized = articlesRaw.map((a) => ({
          headline: a.headline ?? "",
          summaryShort: a.summaryShort ?? "",
          topicTags: safeParseJson<string[]>(a.topicTagsJson, []),
          publishedAt: a.publishedAt,
        }));
        const counts = countPerCategory(normalized);
        const trending = computeTrendingEntities(normalized, { limit: 8 });
        return { counts, trendingCount: trending.length };
      },
      (v) => v,
    );
  }

  // 7. Verify the v2 cache columns exist (match the health probe)
  await step(
    "probe v2-cache columns on Article",
    async () => {
      await db.$queryRawUnsafe(
        `SELECT "synthesisJson", "contrarianJson", "suggestedQuestionsJson", "enrichedAt" FROM "Article" LIMIT 1`,
      );
      return "columns exist";
    },
    (v) => v,
  );

  // 8. Verify imageUrl column exists
  await step(
    "probe imageUrl column on Article",
    async () => {
      await db.$queryRawUnsafe(`SELECT "imageUrl" FROM "Article" LIMIT 1`);
      return "column exists";
    },
    (v) => v,
  );

  return steps;
}

async function handle(req: Request) {
  const expected = process.env.SEED_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "SEED_TOKEN is not configured" }, { status: 503 });
  }
  const url = new URL(req.url);
  const supplied =
    url.searchParams.get("token") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!supplied || supplied !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const steps = await run(req);
  const firstFailure = steps.find((s) => !s.ok);

  return NextResponse.json(
    {
      ok: !firstFailure,
      failedAt: firstFailure?.step ?? null,
      error: firstFailure?.error ?? null,
      commit: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || "unknown",
      category: new URL(req.url).searchParams.get("category") || "top",
      steps,
      hint: firstFailure
        ? diagnose(firstFailure.error?.message || "")
        : "Feed queries all succeeded. The runtime error must be in the render phase — check Vercel function logs for a stack trace containing 'FeedPage' or 'getPersonalizedFeed'.",
    },
    { status: 200 },
  );
}

function diagnose(message: string): string {
  if (/column.*does not exist/i.test(message) || /unknown column/i.test(message)) {
    return "A schema column referenced by Prisma doesn't exist in the live database. `prisma db push` may have failed during the build. Manually run it via Neon SQL editor or trigger a fresh redeploy.";
  }
  if (/relation.*does not exist/i.test(message)) {
    return "A table is missing from the live database. Run `prisma db push` against the production DATABASE_URL.";
  }
  if (/connect.*ECONN|ETIMEDOUT|timeout/i.test(message)) {
    return "Database connection timeout. Check Neon dashboard for pool saturation or a paused branch.";
  }
  if (/prepared statement/i.test(message)) {
    return "Postgres prepared statement error — this usually means the pool is recycling stale connections. Try again, and if persistent, add `?pgbouncer=true` to DATABASE_URL.";
  }
  return "No known diagnosis pattern. Paste the message verbatim for a manual fix.";
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
