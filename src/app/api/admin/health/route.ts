import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Diagnostic endpoint. Token-protected. Reports on deployment version,
 * env var presence (never values), DB reachability, schema version, and
 * corpus counts. Use this to debug "why doesn't X work?" questions
 * without SSH access to the serverless runtime.
 *
 *   https://<your-app>.vercel.app/api/admin/health?token=<SEED_TOKEN>
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function handle(req: Request) {
  const expected = process.env.SEED_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "SEED_TOKEN is not configured on the server." },
      { status: 503 },
    );
  }
  const url = new URL(req.url);
  const supplied =
    url.searchParams.get("token") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!supplied || supplied !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ---- Env ----
  const env: Record<string, string | boolean> = {
    node: process.version,
    vercel: !!process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV || "unknown",
    commit: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || "unknown",
    branch: process.env.VERCEL_GIT_COMMIT_REF || "unknown",
    databaseUrlSet: !!process.env.DATABASE_URL,
    databaseProvider: detectDbProvider(process.env.DATABASE_URL),
    nextauthSecretSet: !!process.env.NEXTAUTH_SECRET,
    nextauthUrl: process.env.NEXTAUTH_URL || "(unset)",
    seedTokenSet: !!process.env.SEED_TOKEN,
    aiProvider: (process.env.AI_PROVIDER || "mock").toLowerCase(),
    openaiKeySet: !!process.env.OPENAI_API_KEY,
    anthropicKeySet: !!process.env.ANTHROPIC_API_KEY,
    aiModelOverride: process.env.AI_MODEL || "(default)",
    ingestLive: process.env.INGEST_LIVE || "0",
  };

  // ---- AI active provider ----
  const aiStatus = determineAIStatus(env);

  // ---- DB ----
  const dbStatus: Record<string, unknown> = { reachable: false };
  let schemaVersion: "v1-base" | "v2-with-cache" | "unknown" = "unknown";
  try {
    const [userCount, sourceCount, clusterCount, articleCount] = await Promise.all([
      db.user.count(),
      db.source.count(),
      db.topicCluster.count(),
      db.article.count(),
    ]);
    dbStatus.reachable = true;
    dbStatus.users = userCount;
    dbStatus.sources = sourceCount;
    dbStatus.clusters = clusterCount;
    dbStatus.articles = articleCount;

    const latest = await db.article.findFirst({
      orderBy: { publishedAt: "desc" },
      include: { source: true },
    });
    if (latest) {
      dbStatus.latestArticle = {
        id: latest.id,
        headline: latest.headline,
        source: latest.source.name,
        publishedAt: latest.publishedAt.toISOString(),
      };
    }

    // Probe the v2 cache columns. If this raw query succeeds, the
    // `prisma db push` in the build ran and the schema is current.
    try {
      await db.$queryRawUnsafe(
        `SELECT "synthesisJson", "contrarianJson", "suggestedQuestionsJson", "enrichedAt" FROM "Article" LIMIT 1`,
      );
      schemaVersion = "v2-with-cache";
    } catch {
      schemaVersion = "v1-base";
    }
  } catch (err) {
    dbStatus.error = (err as Error).message;
  }

  // ---- Diagnosis ----
  const diagnosis = diagnose({
    env,
    aiStatus,
    dbStatus,
    schemaVersion,
  });

  return NextResponse.json(
    {
      ok: diagnosis.ok,
      diagnosis: diagnosis.notes,
      nextActions: diagnosis.nextActions,
      env,
      ai: aiStatus,
      db: dbStatus,
      schemaVersion,
    },
    { status: 200 },
  );
}

function detectDbProvider(url?: string): string {
  if (!url) return "(unset)";
  if (url.startsWith("file:")) return "sqlite";
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) return "postgres";
  if (url.startsWith("mysql://")) return "mysql";
  return "unknown";
}

function determineAIStatus(env: Record<string, string | boolean>) {
  const p = env.aiProvider as string;
  if (p === "openai") {
    return {
      configured: p,
      active: env.openaiKeySet ? "openai" : "mock (key missing)",
      isReal: !!env.openaiKeySet,
    };
  }
  if (p === "anthropic") {
    return {
      configured: p,
      active: env.anthropicKeySet ? "anthropic" : "mock (key missing)",
      isReal: !!env.anthropicKeySet,
    };
  }
  return { configured: p, active: "mock", isReal: false };
}

function diagnose(input: {
  env: Record<string, string | boolean>;
  aiStatus: { isReal: boolean; active: string };
  dbStatus: Record<string, unknown>;
  schemaVersion: string;
}): { ok: boolean; notes: string[]; nextActions: string[] } {
  const notes: string[] = [];
  const nextActions: string[] = [];

  if (!input.dbStatus.reachable) {
    notes.push("Database is NOT reachable. DATABASE_URL may be wrong or Prisma failed to initialize.");
    nextActions.push("Check DATABASE_URL in Vercel env vars and redeploy.");
    return { ok: false, notes, nextActions };
  }

  const articles = (input.dbStatus.articles as number) ?? 0;
  const sources = (input.dbStatus.sources as number) ?? 0;

  if (sources === 0) {
    notes.push("No sources in the DB. Seeding has not been run, or the wrong DB is connected.");
    nextActions.push(
      "Hit /api/admin/seed?token=<SEED_TOKEN> to load the 27 seeded sources.",
    );
  }
  if (articles === 0) {
    notes.push("No articles in the DB.");
    nextActions.push(
      "After seeding, hit /api/admin/ingest?token=<SEED_TOKEN> to pull live RSS articles.",
    );
  }

  if (input.schemaVersion === "v1-base") {
    notes.push(
      "Schema is older than the dynamic-enrichment columns (synthesisJson, contrarianJson, suggestedQuestionsJson, enrichedAt). The latest build may not have been deployed, or `prisma db push` was skipped.",
    );
    nextActions.push(
      "Go to Vercel → Deployments → top row → ⋯ → Redeploy (uncheck Build Cache). This runs `prisma db push` and applies the new columns.",
    );
  }

  if (!input.aiStatus.isReal) {
    notes.push(
      `AI provider is in mock mode (active=${input.aiStatus.active}). Summaries and cross-source synthesis will be deterministic fallbacks, not real model output.`,
    );
    nextActions.push(
      "Set AI_PROVIDER=anthropic (or openai) and the matching API key in Vercel env vars, then redeploy.",
    );
  }

  if (notes.length === 0) {
    notes.push("Everything looks healthy. 🎉");
  }
  return { ok: notes[0] === "Everything looks healthy. 🎉", notes, nextActions };
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
