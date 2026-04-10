import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getPersonalizedFeed } from "@/lib/feed";
import { ArticleCard } from "@/components/article-card";
import { RefreshFeedButton } from "@/components/refresh-feed-button";
import { FeedFilters } from "@/components/feed-filters";
import { safeParseJson } from "@/lib/utils";
import {
  CATEGORIES,
  computeTrendingEntities,
  countPerCategory,
} from "@/lib/categories";

export const dynamic = "force-dynamic";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (!user.preference?.onboardingCompleted) redirect("/onboarding");

  const { category } = await searchParams;
  const activeCategory = category && CATEGORIES.some((c) => c.slug === category) ? category : "top";

  // Core feed query. Never allowed to fall back silently — if this fails,
  // the error boundary (`error.tsx`) catches it and the user sees a real
  // message instead of the cryptic Next.js digest screen.
  const articles = await getPersonalizedFeed(user.id, {
    limit: 40,
    category: activeCategory,
  });

  // Stats (category counts + trending entities) are cosmetic. Wrap in
  // try/catch so a single bad article can never crash the whole page.
  let categoryChips: Array<{ slug: string; label: string; count: number }> = [];
  let trending: Array<{ label: string; count: number }> = [];
  try {
    const recentSince = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentForStats = await db.article.findMany({
      where: { publishedAt: { gte: sevenDaysAgo } },
      select: {
        headline: true,
        summaryShort: true,
        topicTagsJson: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: "desc" },
      take: 300,
    });
    const normalized = recentForStats.map((a) => ({
      headline: a.headline ?? "",
      summaryShort: a.summaryShort ?? "",
      topicTags: safeParseJson<string[]>(a.topicTagsJson, []),
      publishedAt: a.publishedAt,
    }));
    const counts = countPerCategory(normalized, { since: recentSince });
    trending = computeTrendingEntities(normalized, { limit: 8, since: recentSince });
    categoryChips = CATEGORIES.map((c) => ({
      slug: c.slug,
      label: c.label,
      count: counts[c.slug] || 0,
    }));
  } catch (err) {
    console.error("[feed] stats computation failed:", (err as Error).message);
    // Fall back to plain category chips with zero counts — still lets the
    // user navigate between categories even if trending is broken.
    categoryChips = CATEGORIES.map((c) => ({ slug: c.slug, label: c.label, count: 0 }));
    trending = [];
  }

  const latestArticle = await db.article.findFirst({
    orderBy: { rawIngestedAt: "desc" },
    select: { rawIngestedAt: true },
  });

  const bookmarks = await db.bookmark.findMany({
    where: { userId: user.id },
    select: { articleId: true },
  });
  const bookmarkedIds = new Set(bookmarks.map((b) => b.articleId));

  const followedTopics = safeParseJson<string[]>(user.preference.followedTopics, []);

  const activeCategoryLabel =
    CATEGORIES.find((c) => c.slug === activeCategory)?.label ?? "Top stories";

  return (
    <div className="container grid gap-8 py-6 sm:py-8 lg:grid-cols-[1fr_280px]">
      <div className="min-w-0">
        {/* Header with refresh button */}
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="label">Your feed</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {activeCategoryLabel}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              Ranked by recency, your topic interests, and the sources you trust.
            </p>
          </div>
          <RefreshFeedButton
            lastRefreshedAt={latestArticle?.rawIngestedAt?.toISOString() ?? null}
          />
        </div>

        {/* Category + trending filter bar. Wrapped in Suspense because
            FeedFilters uses useSearchParams which needs a boundary on
            Next.js 15.5+. */}
        <div className="mb-6">
          <Suspense fallback={<div className="h-10" />}>
            <FeedFilters
              categories={categoryChips}
              activeCategory={activeCategory}
              trending={trending}
            />
          </Suspense>
        </div>

        {articles.length === 0 ? (
          <EmptyFeed activeCategory={activeCategory} />
        ) : (
          <div className="grid gap-4">
            {articles.map((a) => (
              <ArticleCard
                key={a.id}
                bookmarked={bookmarkedIds.has(a.id)}
                article={{
                  id: a.id,
                  headline: a.headline,
                  summaryShort: a.summaryShort,
                  url: a.url,
                  publishedAt: a.publishedAt,
                  topicTags: safeParseJson<string[]>(a.topicTagsJson, []),
                  source: { name: a.source.name, trustTier: a.source.trustTier },
                }}
              />
            ))}
          </div>
        )}
      </div>

      <aside className="space-y-6">
        <div className="card p-4">
          <div className="label">Following</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {followedTopics.length ? (
              followedTopics.map((t) => (
                <span key={t} className="chip-brand">
                  #{t}
                </span>
              ))
            ) : (
              <div className="text-sm text-ink-muted">No topics yet.</div>
            )}
          </div>
          <Link
            href="/settings"
            className="mt-3 inline-block text-xs text-brand hover:underline"
          >
            Edit preferences →
          </Link>
        </div>

        {trending.length > 0 && (
          <div className="card p-4">
            <div className="label">Trending now</div>
            <div className="mt-2 space-y-1.5 text-sm">
              {trending.slice(0, 6).map((t) => (
                <Link
                  key={t.label}
                  href={`/search?q=${encodeURIComponent(t.label)}`}
                  className="flex items-center justify-between rounded-lg px-2 py-1 text-ink-muted hover:bg-bg-elevated hover:text-ink"
                >
                  <span className="truncate">{t.label}</span>
                  <span className="ml-2 shrink-0 text-xs text-ink-faint">{t.count}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function EmptyFeed({ activeCategory }: { activeCategory: string }) {
  return (
    <div className="card p-8 text-center">
      <h3 className="text-lg font-semibold">
        {activeCategory === "top"
          ? "Your feed is empty."
          : `No articles in this category right now.`}
      </h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
        {activeCategory === "top" ? (
          <>
            No articles are loaded yet. Click <strong>Refresh feed</strong> above to pull
            fresh articles from the RSS sources.
          </>
        ) : (
          <>
            Try a different category, or click <strong>Refresh feed</strong> to pull
            new coverage.
          </>
        )}
      </p>
      <Link href="/feed" className="btn-ghost mt-4">
        Back to Top stories
      </Link>
    </div>
  );
}
