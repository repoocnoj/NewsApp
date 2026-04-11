import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ai } from "@/lib/ai";
import {
  enrichArticleAnalysis,
  enrichArticleSummary,
  findRelatedArticles,
} from "@/lib/article-enrich";

/**
 * Reproduces the article detail page's data fetching + AI enrichment
 * pipeline stage by stage and returns the FIRST step that throws with
 * the full error message.
 *
 * Usage:
 *   /api/admin/article-debug?token=<SEED_TOKEN>            (picks the latest article)
 *   /api/admin/article-debug?token=<SEED_TOKEN>&id=<id>    (specific article)
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type StepResult = {
  step: string;
  ok: boolean;
  ms?: number;
  info?: unknown;
  error?: { message: string; name: string; stack?: string };
};

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

  const requestedId = url.searchParams.get("id") || undefined;
  const steps: StepResult[] = [];

  async function step<T>(
    name: string,
    fn: () => Promise<T>,
    describe?: (v: T) => unknown,
  ): Promise<T | undefined> {
    const started = Date.now();
    try {
      const v = await fn();
      steps.push({
        step: name,
        ok: true,
        ms: Date.now() - started,
        info: describe ? describe(v) : undefined,
      });
      return v;
    } catch (err) {
      const e = err as Error;
      steps.push({
        step: name,
        ok: false,
        ms: Date.now() - started,
        error: {
          name: e.name,
          message: e.message,
          stack: e.stack?.split("\n").slice(0, 12).join("\n"),
        },
      });
      return undefined;
    }
  }

  // 1. Resolve which article to debug
  const articleRaw = await step(
    "findArticle",
    async () => {
      if (requestedId) {
        return db.article.findUnique({
          where: { id: requestedId },
          include: {
            source: true,
            topicCluster: { include: { timelineEvents: true } },
          },
        });
      }
      return db.article.findFirst({
        orderBy: { publishedAt: "desc" },
        include: {
          source: true,
          topicCluster: { include: { timelineEvents: true } },
        },
      });
    },
    (a) =>
      a
        ? {
            id: a.id,
            headline: a.headline.slice(0, 100),
            source: a.source.name,
            hasImage: !!a.imageUrl,
            hasCluster: !!a.topicCluster,
          }
        : null,
  );

  if (!articleRaw) {
    return NextResponse.json({
      ok: false,
      error: "No article found",
      steps,
    });
  }

  const { topicCluster, ...articleBase } = articleRaw;

  // 2. Lazy AI summary
  const article = await step(
    "enrichArticleSummary",
    () => enrichArticleSummary(articleBase),
    (a) => ({
      summaryLength: a?.summaryLong.length ?? 0,
      hasKeyPoints: a?.keyPointsJson !== "[]",
    }),
  );

  if (!article) {
    return NextResponse.json({
      ok: false,
      failedAt: steps[steps.length - 1]?.step,
      steps,
    });
  }

  // 3. Find related articles (similarity)
  const relatedSet = await step(
    "findRelatedArticles",
    () => findRelatedArticles(article, { limit: 6 }),
    (s) => ({
      relatedCount: s?.related.length ?? 0,
      contrarianCount: s?.contrarian.length ?? 0,
    }),
  );

  if (!relatedSet) {
    return NextResponse.json({
      ok: false,
      failedAt: steps[steps.length - 1]?.step,
      steps,
    });
  }

  // 4. AI synthesis (the big one — this is the most likely failure point
  // because it makes 3 Anthropic/OpenAI calls via Promise.all)
  await step(
    "enrichArticleAnalysis",
    () => enrichArticleAnalysis(article, relatedSet),
    (b) => ({
      fromCache: b?.fromCache,
      hasCommonFacts: (b?.synthesis?.commonFacts.length ?? 0) > 0,
      hasSuggestions: (b?.suggestions?.questions?.length ?? 0) > 0,
    }),
  );

  // 5. Timeline (optional AI call when no seeded cluster)
  const relatedArticles = relatedSet.related.map((r) => r.article);
  await step(
    "timeline",
    async () => {
      if (topicCluster && topicCluster.timelineEvents.length > 0) {
        return { source: "seed", events: topicCluster.timelineEvents.length };
      }
      if (relatedArticles.length === 0) return { source: "none" };
      const events = await ai.timeline({
        topic: article.headline,
        articles: [article, ...relatedArticles].map((a) => ({
          source: a.source.name,
          url: a.url,
          headline: a.headline,
          publishedAt: a.publishedAt.toISOString(),
          summary: a.summaryShort,
        })),
      });
      return { source: "ai", events: events.length };
    },
    (v) => v,
  );

  // 6. Probe AI provider directly to isolate AI from other failures
  await step(
    "direct AI ping",
    async () => {
      const reply = await ai.summarizeArticle({
        headline: "Diagnostic probe",
        text: "This is a short diagnostic text.",
      });
      return reply;
    },
    (v) => ({
      shortLength: v?.short.length ?? 0,
      hasKeyPoints: (v?.keyPoints?.length ?? 0) > 0,
    }),
  );

  const firstFailure = steps.find((s) => !s.ok);

  return NextResponse.json({
    ok: !firstFailure,
    failedAt: firstFailure?.step ?? null,
    error: firstFailure?.error ?? null,
    commit: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7),
    articleId: articleRaw.id,
    steps,
  });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
