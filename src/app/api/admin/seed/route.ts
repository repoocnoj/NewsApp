import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runSeed } from "@/lib/seed/runner";

/**
 * One-shot seed endpoint for populating a fresh production database.
 *
 * Protected by SEED_TOKEN. Safe to call multiple times — the underlying
 * `runSeed` is idempotent.
 *
 *   curl "https://<your-app>.vercel.app/api/admin/seed?token=<SEED_TOKEN>"
 *     or simply open that URL in a browser.
 */

export const dynamic = "force-dynamic";
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

  try {
    const result = await runSeed(db, { enrichWithAI: false });
    return NextResponse.json({
      ok: true,
      message:
        result.articlesAdded > 0
          ? `Seeded ${result.articlesAdded} new article(s). Total: ${result.articles} articles across ${result.clusters} clusters and ${result.sources} sources.`
          : `Database already contains ${result.articles} article(s). No new rows added.`,
      stats: result,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "Seed failed.",
        detail: (err as Error).message,
      },
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
