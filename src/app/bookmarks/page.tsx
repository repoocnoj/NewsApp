import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ArticleCard } from "@/components/article-card";
import { safeParseJson } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BookmarksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const bookmarks = await db.bookmark.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      article: { include: { source: true } },
    },
  });

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-6">
        <div className="label">Saved</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Your bookmarks</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Articles you&rsquo;ve saved for later. Click to open the detail view.
        </p>
      </div>

      {bookmarks.length === 0 ? (
        <div className="card p-8 text-center">
          <h3 className="text-lg font-semibold">No bookmarks yet</h3>
          <p className="mt-1 text-sm text-ink-muted">
            Save articles from your feed by tapping the bookmark icon.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {bookmarks.map((b) => (
            <ArticleCard
              key={b.id}
              bookmarked
              article={{
                id: b.article.id,
                headline: b.article.headline,
                summaryShort: b.article.summaryShort,
                url: b.article.url,
                publishedAt: b.article.publishedAt,
                topicTags: safeParseJson<string[]>(b.article.topicTagsJson, []),
                source: {
                  name: b.article.source.name,
                  trustTier: b.article.source.trustTier,
                },
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
