import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ArticleCard } from "@/components/article-card";
import { safeParseJson } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const { q } = await searchParams;
  const query = (q ?? "").trim();

  let articles: Awaited<ReturnType<typeof searchArticles>> = [];
  if (query) {
    articles = await searchArticles(query);
  }

  const bookmarks = await db.bookmark.findMany({
    where: { userId: user.id },
    select: { articleId: true },
  });
  const bookmarkedIds = new Set(bookmarks.map((b) => b.articleId));

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-6">
        <div className="label">Search</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Search articles</h1>
      </div>

      <form method="get" className="card flex gap-2 p-3">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search headlines, summaries, and topics…"
          className="input"
        />
        <button type="submit" className="btn-primary">
          Search
        </button>
      </form>

      <div className="mt-6 space-y-4">
        {query && articles.length === 0 && (
          <div className="card p-6 text-sm text-ink-muted">
            No results for <span className="text-ink">&ldquo;{query}&rdquo;</span>. Try a broader query or check your
            spelling.
          </div>
        )}
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
        {!query && (
          <div className="card p-6 text-sm text-ink-muted">
            Try searching for <TryLink q="Hormuz" />, <TryLink q="oil" />, <TryLink q="AI regulation" />, or <TryLink q="Iran" />.
          </div>
        )}
      </div>
    </div>
  );
}

function TryLink({ q }: { q: string }) {
  return (
    <Link href={`/search?q=${encodeURIComponent(q)}`} className="text-brand hover:underline">
      {q}
    </Link>
  );
}

async function searchArticles(query: string) {
  // SQLite doesn't support case-insensitive LIKE mode flags via Prisma's
  // `mode: "insensitive"`. We normalize to lowercase LIKE instead.
  const like = `%${query.toLowerCase()}%`;
  // Raw query for case-insensitive search across headline + summary + tags
  const rows = await db.$queryRawUnsafe<
    Array<{
      id: string;
      headline: string;
      summaryShort: string;
      url: string;
      publishedAt: Date;
      topicTagsJson: string;
      sourceId: string;
    }>
  >(
    `SELECT id, headline, summaryShort, url, publishedAt, topicTagsJson, sourceId
     FROM Article
     WHERE lower(headline) LIKE ? OR lower(summaryShort) LIKE ? OR lower(summaryLong) LIKE ? OR lower(topicTagsJson) LIKE ?
     ORDER BY publishedAt DESC
     LIMIT 40`,
    like,
    like,
    like,
    like,
  );
  if (rows.length === 0) return [];
  const sources = await db.source.findMany({ where: { id: { in: rows.map((r) => r.sourceId) } } });
  const byId = new Map(sources.map((s) => [s.id, s]));
  return rows.map((r) => ({
    id: r.id,
    headline: r.headline,
    summaryShort: r.summaryShort,
    url: r.url,
    publishedAt: new Date(r.publishedAt),
    topicTagsJson: r.topicTagsJson,
    source: byId.get(r.sourceId)!,
  }));
}
