import { db } from "@/lib/db";
import { safeParseJson } from "@/lib/utils";
import { articleMatchesCategory } from "@/lib/categories";

/**
 * Lightweight personalized ranking:
 *   score = recency * 1.0
 *         + topicMatch * 2.0
 *         + sourcePreferred * 2.5
 *         - sourceExcluded * 1000   (effectively hides)
 *         + trustTier bump for "high"
 *         + liked signal bump
 *         - disliked signal penalty
 *
 * Simple, robust, and explainable. Good enough for an MVP while leaving
 * the door open to embeddings/vector retrieval later.
 */
export async function getPersonalizedFeed(
  userId: string,
  opts?: { limit?: number; category?: string },
) {
  const limit = opts?.limit ?? 30;
  const category = opts?.category && opts.category !== "top" ? opts.category : undefined;

  const pref = await db.userPreference.findUnique({ where: { userId } });
  const followedTopics = pref ? safeParseJson<string[]>(pref.followedTopics, []) : [];
  const preferredSources = pref ? safeParseJson<string[]>(pref.preferredSourceIds, []) : [];
  const excludedSources = pref ? safeParseJson<string[]>(pref.excludedSourceIds, []) : [];

  const signals = await db.articleSignal.findMany({ where: { userId } });
  const likedIds = new Set(signals.filter((s) => s.kind === "like").map((s) => s.articleId));
  const dislikedIds = new Set(signals.filter((s) => s.kind === "dislike").map((s) => s.articleId));

  const articles = await db.article.findMany({
    where: excludedSources.length ? { NOT: { sourceId: { in: excludedSources } } } : {},
    include: { source: true, topicCluster: true },
    orderBy: { publishedAt: "desc" },
    // Larger window when a category is applied, so filtering has enough
    // to work with after excluding non-matching articles.
    take: category ? 500 : 200,
  });

  const filtered = category
    ? articles.filter((a) =>
        articleMatchesCategory(
          {
            headline: a.headline,
            summaryShort: a.summaryShort,
            topicTags: safeParseJson<string[]>(a.topicTagsJson, []),
          },
          category,
        ),
      )
    : articles;

  const now = Date.now();
  const ranked = filtered
    .map((a) => {
      const ageHours = Math.max(1, (now - a.publishedAt.getTime()) / (1000 * 60 * 60));
      const recency = 48 / (ageHours + 24); // 0..1-ish
      const tags = safeParseJson<string[]>(a.topicTagsJson, []);
      const topicMatch = tags.filter((t) => followedTopics.includes(t)).length;
      const sourcePreferred = preferredSources.includes(a.sourceId) ? 1 : 0;
      const trustBump = a.source.trustTier === "high" ? 0.5 : 0;
      const likeBump = likedIds.has(a.id) ? 0.75 : 0;
      const dislikePen = dislikedIds.has(a.id) ? 1.5 : 0;
      const score =
        recency * 1.0 +
        topicMatch * 2.0 +
        sourcePreferred * 2.5 +
        trustBump -
        dislikePen +
        likeBump;
      return { article: a, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return ranked.map((r) => r.article);
}
