"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function savePreferencesAction(input: {
  topics: string[];
  preferredSources: string[];
  excludedSources: string[];
  likedArticles: string[];
  dislikedArticles: string[];
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

  for (const articleId of input.likedArticles) {
    await db.articleSignal.upsert({
      where: { userId_articleId_kind: { userId: user.id, articleId, kind: "like" } },
      create: { userId: user.id, articleId, kind: "like" },
      update: {},
    });
  }
  for (const articleId of input.dislikedArticles) {
    await db.articleSignal.upsert({
      where: { userId_articleId_kind: { userId: user.id, articleId, kind: "dislike" } },
      create: { userId: user.id, articleId, kind: "dislike" },
      update: {},
    });
  }
}
