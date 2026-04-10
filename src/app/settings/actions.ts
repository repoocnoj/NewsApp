"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { runLiveIngestion } from "@/lib/ingest/runner";

export async function saveSettingsAction(input: {
  topics: string[];
  preferredSources: string[];
  excludedSources: string[];
}) {
  const user = await requireUser();
  await db.userPreference.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      followedTopics: JSON.stringify(input.topics),
      preferredSourceIds: JSON.stringify(input.preferredSources),
      excludedSourceIds: JSON.stringify(input.excludedSources),
      onboardingCompleted: true,
    },
    update: {
      followedTopics: JSON.stringify(input.topics),
      preferredSourceIds: JSON.stringify(input.preferredSources),
      excludedSourceIds: JSON.stringify(input.excludedSources),
      onboardingCompleted: true,
    },
  });
}

/**
 * User-facing "Refresh articles" action. Triggers a live RSS pull across
 * every active source. Any signed-in user can call this — there's no
 * separate auth because ingestion is read-only on external feeds and
 * idempotent on the article URL.
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
  return {
    fetched: result.fetched,
    failed: result.failed,
    skippedSources: result.skippedSources ?? 0,
  };
}
