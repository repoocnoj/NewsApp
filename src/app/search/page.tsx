import { redirect } from "next/navigation";
import Link from "next/link";
import { Prisma } from "@prisma/client";
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

  const articles = query ? await searchArticles(query) : [];

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
              imageUrl: a.imageUrl,
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
  // Two-step search: raw SQL for case-insensitive matching (portable
  // between sqlite and postgres by using LOWER() on both sides), then
  // a typed `findMany` to return fully-typed rows with the source
  // relation. Quoted identifiers (`"Article"`, `"summaryShort"`)
  // work on both providers: postgres respects the quotes, sqlite
  // ignores them.
  const like = `%${query.toLowerCase()}%`;
  const idRows = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM "Article"
    WHERE LOWER(headline) LIKE ${like}
       OR LOWER("summaryShort") LIKE ${like}
       OR LOWER("summaryLong") LIKE ${like}
       OR LOWER("topicTagsJson") LIKE ${like}
    ORDER BY "publishedAt" DESC
    LIMIT 40
  `);
  if (idRows.length === 0) return [];
  const rows = await db.article.findMany({
    where: { id: { in: idRows.map((r) => r.id) } },
    include: { source: true },
    orderBy: { publishedAt: "desc" },
  });
  return rows;
}
