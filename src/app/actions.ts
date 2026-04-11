"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { runLiveIngestion } from "@/lib/ingest/runner";

/**
 * Shared server action: pull fresh articles from every active RSS source.
 * Called from the Settings page and from the Feed page's refresh button.
 *
 * Idempotent (articles are upserted on URL). Returns a compact result the
 * client can render into a status banner.
 */
export async function refreshArticlesAction(): Promise<{
  fetched: number;
  failed: number;
  skippedSources: number;
}> {
  await requireUser();
  const result = await runLiveIngestion({
    force: true,
    limit: 8,
    enrichWithAI: false,
  });
  revalidatePath("/feed");
  revalidatePath("/settings");
  return {
    fetched: result.fetched,
    failed: result.failed,
    skippedSources: result.skippedSources ?? 0,
  };
}

/**
 * Record a user signal on an article — thumbs up (like), thumbs down
 * (dislike), view, or bookmark-intent. These feed directly into the
 * personalized ranking in `src/lib/feed.ts`. Idempotent: sending the
 * same kind twice is a no-op; sending the opposite kind replaces it.
 */
export async function signalArticleAction(
  articleId: string,
  kind: "like" | "dislike" | "view",
): Promise<{ ok: true }> {
  const user = await requireUser();

  if (kind === "like" || kind === "dislike") {
    // Like and dislike are mutually exclusive — toggling one clears the other.
    const opposite = kind === "like" ? "dislike" : "like";
    await db.articleSignal.deleteMany({
      where: { userId: user.id, articleId, kind: opposite },
    });
  }

  await db.articleSignal.upsert({
    where: { userId_articleId_kind: { userId: user.id, articleId, kind } },
    create: { userId: user.id, articleId, kind },
    update: {},
  });

  // The feed ranking takes these signals into account; revalidate so
  // the next render reflects the new score.
  revalidatePath("/feed");
  revalidatePath("/swipe");
  return { ok: true };
}
