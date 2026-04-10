"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

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
