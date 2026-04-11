import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getPersonalizedFeed } from "@/lib/feed";
import { SwipeDeck, type SwipeArticle } from "./swipe-deck";
import { safeParseJson } from "@/lib/utils";
import { CATEGORIES } from "@/lib/categories";

export const dynamic = "force-dynamic";

export default async function SwipePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (!user.preference?.onboardingCompleted) redirect("/onboarding");

  const { category } = await searchParams;
  const activeCategory = category && CATEGORIES.some((c) => c.slug === category) ? category : "top";

  const articles = await getPersonalizedFeed(user.id, {
    limit: 30,
    category: activeCategory,
  });

  const bookmarks = await db.bookmark.findMany({
    where: { userId: user.id },
    select: { articleId: true },
  });
  const bookmarkedIds = new Set(bookmarks.map((b) => b.articleId));

  const signals = await db.articleSignal.findMany({ where: { userId: user.id } });
  const likedIds = new Set(
    signals.filter((s) => s.kind === "like").map((s) => s.articleId),
  );
  const dislikedIds = new Set(
    signals.filter((s) => s.kind === "dislike").map((s) => s.articleId),
  );

  const cards: SwipeArticle[] = articles.map((a) => ({
    id: a.id,
    headline: a.headline,
    summaryShort: a.summaryShort,
    summaryLong: a.summaryLong || a.summaryShort,
    url: a.url,
    publishedAt: a.publishedAt.toISOString(),
    imageUrl: a.imageUrl ?? null,
    topicTags: safeParseJson<string[]>(a.topicTagsJson, []).slice(0, 4),
    sourceName: a.source.name,
    sourceTrustTier: a.source.trustTier,
    bookmarked: bookmarkedIds.has(a.id),
    liked: likedIds.has(a.id),
    disliked: dislikedIds.has(a.id),
  }));

  return <SwipeDeck articles={cards} activeCategory={activeCategory} />;
}
