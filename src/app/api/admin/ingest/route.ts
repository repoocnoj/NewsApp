import { NextResponse } from "next/server";
import { runLiveIngestion } from "@/lib/ingest/runner";

/**
 * Manually trigger a live RSS pull across all active sources.
 *
 * Protected by SEED_TOKEN. Safe to call multiple times — ingestion is
 * idempotent on article URL.
 *
 *   https://<your-app>.vercel.app/api/admin/ingest?token=<SEED_TOKEN>
 *
 * You can also limit how many articles per source (default 10):
 *
 *   /api/admin/ingest?token=…&limit=5
 *
 * Note: several large outlets (WSJ, Bloomberg, NYT, FT, Economist) either
 * don't publish open RSS or their feeds only ship headlines + previews.
 * Those will either error softly or import headline-only rows. The seeded
 * strategy per source in `seed-data.ts` documents which ones need an
 * authenticated/licensed integration to produce full text.
 */

export const dynamic = "force-dynamic";
// Serverless max: Vercel Hobby allows up to 60s, Pro up to 300s.
export const maxDuration = 60;

async function handle(req: Request) {
  const expected = process.env.SEED_TOKEN;
  if (!expected) {
    return NextResponse.json(
      {
        error: "SEED_TOKEN is not configured on the server.",
        hint:
          "Set SEED_TOKEN in your environment variables (any random string) and redeploy.",
      },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const tokenFromQuery = url.searchParams.get("token");
  const tokenFromHeader = req.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  const supplied = tokenFromQuery || tokenFromHeader;
  if (!supplied || supplied !== expected) {
    return NextResponse.json(
      { error: "Unauthorized. Missing or invalid ?token=… query parameter." },
      { status: 401 },
    );
  }

  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") || "10", 10) || 10, 1),
    50,
  );
  const enrichWithAI = url.searchParams.get("ai") === "1";

  try {
    const result = await runLiveIngestion({
      force: true,
      limit,
      enrichWithAI,
    });
    return NextResponse.json({
      ok: true,
      message: `Ingested ${result.fetched} article(s). ${result.failed} failure(s). ${result.skippedSources ?? 0} source(s) skipped (no RSS URL).`,
      stats: result,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "Ingestion failed.", detail: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
