"use server";

import { revalidatePath } from "next/cache";
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
