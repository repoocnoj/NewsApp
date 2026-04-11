import Link from "next/link";
import { Bookmark, ExternalLink } from "lucide-react";
import { formatRelative } from "@/lib/utils";
import { BookmarkButton } from "@/components/bookmark-button";
import { SafeImage } from "@/components/safe-image";

type ArticleCardProps = {
  article: {
    id: string;
    headline: string;
    summaryShort: string;
    url: string;
    publishedAt: Date;
    topicTags: string[];
    imageUrl?: string | null;
    source: { name: string; trustTier: string };
  };
  bookmarked?: boolean;
  showBookmark?: boolean;
};

export function ArticleCard({ article, bookmarked, showBookmark = true }: ArticleCardProps) {
  const hasImage = !!article.imageUrl;
  return (
    <article className="card card-hover overflow-hidden">
      <div className="flex gap-0 sm:flex-row">
        {hasImage && (
          <Link
            href={`/article/${article.id}`}
            className="relative block h-32 w-32 shrink-0 overflow-hidden bg-bg-elevated sm:h-auto sm:w-44"
          >
            <SafeImage
              src={article.imageUrl!}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
            />
          </Link>
        )}
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                <span className="font-medium text-ink-muted">{article.source.name}</span>
                {article.source.trustTier === "state-affiliated" && (
                  <span className="chip text-accent-warn">state-affiliated</span>
                )}
                <span>·</span>
                <span>{formatRelative(article.publishedAt)}</span>
              </div>
              <Link href={`/article/${article.id}`} className="group mt-1 block">
                <h3 className="text-base font-semibold leading-snug group-hover:text-brand sm:text-lg">
                  {article.headline}
                </h3>
              </Link>
              <p className="mt-2 text-sm text-ink-muted line-clamp-2 sm:line-clamp-3">
                {article.summaryShort}
              </p>
              {article.topicTags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {article.topicTags.slice(0, 4).map((t) => (
                    <span key={t} className="chip">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {showBookmark && (
              <div className="flex flex-col gap-1">
                <BookmarkButton articleId={article.id} initial={!!bookmarked} />
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-muted hover:text-ink"
                  title="Open source"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export { Bookmark };
