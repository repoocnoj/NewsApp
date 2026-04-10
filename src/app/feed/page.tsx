import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getPersonalizedFeed } from "@/lib/feed";
import { ArticleCard } from "@/components/article-card";
import { safeParseJson } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (!user.preference?.onboardingCompleted) redirect("/onboarding");

  const articles = await getPersonalizedFeed(user.id, { limit: 40 });
  const bookmarks = await db.bookmark.findMany({
    where: { userId: user.id },
    select: { articleId: true },
  });
  const bookmarkedIds = new Set(bookmarks.map((b) => b.articleId));

  const followedTopics = safeParseJson<string[]>(user.preference.followedTopics, []);
  const clusters = await db.topicCluster.findMany({
    take: 6,
    include: { articles: { take: 1 } },
  });

  return (
    <div className="container grid gap-8 py-8 lg:grid-cols-[1fr_280px]">
      <div>
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="label">Your feed</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              Top stories for {user.name || "you"}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              Ranked by recency, your topic interests, and the sources you trust.
            </p>
          </div>
          <Link href="/settings" className="btn-ghost text-sm">
            Tune preferences
          </Link>
        </div>

        {articles.length === 0 ? (
          <EmptyFeed />
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
        </div>

        <div className="card p-4">
          <div className="label">Topic clusters</div>
          <div className="mt-2 space-y-2">
            {clusters.map((c) => (
              <Link
                key={c.id}
                href={c.articles[0] ? `/article/${c.articles[0].id}` : "/feed"}
                className="block rounded-xl border border-line px-3 py-2 text-sm hover:bg-bg-elevated"
              >
                <div className="font-medium">{c.label}</div>
                <div className="mt-0.5 line-clamp-2 text-xs text-ink-muted">
                  {c.canonicalQuestion}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function EmptyFeed() {
  return (
    <div className="card p-8 text-center">
      <h3 className="text-lg font-semibold">Your feed is empty.</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
        No articles are loaded in this deployment yet. If you&rsquo;re the admin, populate
        demo content by opening{" "}
        <code className="rounded bg-bg-elevated px-1.5 py-0.5 text-xs">
          /api/admin/seed?token=&lt;SEED_TOKEN&gt;
        </code>{" "}
        in your browser, or run{" "}
        <code className="rounded bg-bg-elevated px-1.5 py-0.5 text-xs">npm run db:seed</code>{" "}
        locally. You can also enable live RSS ingestion — see the README.
      </p>
      <Link href="/settings" className="btn-primary mt-4">
        Update preferences
      </Link>
    </div>
  );
}
