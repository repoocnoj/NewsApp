import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Destructive admin endpoint: deletes ALL articles (and cascades to
 * article relationships, bookmarks, view signals, and conversations
 * referencing those articles). Sources, topic clusters, timeline
 * events, users, and preferences are preserved.
 *
 * Use this to clean up the hand-written demo articles before relying
 * on live RSS ingestion, or to wipe and re-ingest from scratch.
 *
 *   https://<your-app>.vercel.app/api/admin/reset-articles?token=<SEED_TOKEN>
 *
 * Requires a double-confirmation via `?confirm=yes` to reduce the risk
 * of accidentally clicking the URL.
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

  const confirm = url.searchParams.get("confirm");
  if (confirm !== "yes") {
    return NextResponse.json(
      {
        ok: false,
        message:
          "This endpoint deletes ALL articles. Add &confirm=yes to the URL to actually run it.",
        example: `${url.pathname}?token=…&confirm=yes`,
      },
      { status: 400 },
    );
  }

  try {
    const before = await db.article.count();
    // Cascades are defined on the foreign keys (bookmarks, signals,
    // relationships, messages/conversations via SetNull), so a plain
    // deleteMany is safe.
    const { count } = await db.article.deleteMany({});
    return NextResponse.json({
      ok: true,
      message: `Deleted ${count} article(s). (${before} total before.)`,
      stats: { deleted: count, remaining: 0 },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "Delete failed.", detail: (err as Error).message },
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
