import Link from "next/link";
import { ExternalLink, Layers } from "lucide-react";
import { formatRelative } from "@/lib/utils";
import { BookmarkButton } from "@/components/bookmark-button";
import { SafeImage } from "@/components/safe-image";
import type { StoryGroup } from "@/lib/story-groups";

/**
 * A feed card that represents a STORY (event) rather than a single article.
 *
 * Shows:
 *   - The primary article's headline, source, and image
 *   - "Also reported by BBC, NPR, +2 more" when multiple sources cover it
 *   - Each source name links to that source's version of the story
 *   - Fallback image from related articles when primary has none
 */
export function StoryCard({
  group,
  bookmarked,
}: {
  group: StoryGroup;
  bookmarked: boolean;
}) {
  const { primary, imageUrl, otherSources, sourceCount } = group;
  const topicTags = safeParse(primary.topicTagsJson as string);

  return (
    <article className="card card-hover overflow-hidden">
      <div className="flex gap-0 sm:flex-row">
        {imageUrl && (
          <Link
            href={`/article/${primary.id}`}
            className="relative block h-32 w-32 shrink-0 overflow-hidden bg-bg-elevated sm:h-auto sm:w-44"
          >
            <SafeImage
              src={imageUrl}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
            />
          </Link>
        )}
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                <span className="font-medium text-ink-muted">
                  {primary.source.name}
                </span>
                {primary.source.trustTier === "state-affiliated" && (
                  <span className="chip text-accent-warn">state-affiliated</span>
                )}
                <span>·</span>
                <span>{formatRelative(primary.publishedAt)}</span>
                {sourceCount > 1 && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 text-brand">
                      <Layers className="h-3 w-3" />
                      {sourceCount} sources
                    </span>
                  </>
                )}
              </div>
              <Link href={`/article/${primary.id}`} className="group mt-1 block">
                <h3 className="text-base font-semibold leading-snug group-hover:text-brand sm:text-lg">
                  {primary.headline}
                </h3>
              </Link>
              <p className="mt-2 text-sm text-ink-muted line-clamp-2 sm:line-clamp-3">
                {primary.summaryShort}
              </p>

              {/* "Also reported by" line */}
              {otherSources.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
                  <span>Also:</span>
                  {otherSources.slice(0, 3).map((s) => (
                    <Link
                      key={s.id}
                      href={`/article/${s.id}`}
                      className="rounded-full border border-line bg-bg-subtle px-2 py-0.5 hover:border-brand/40 hover:text-ink"
                      title={s.headline}
                    >
                      {s.sourceName}
                    </Link>
                  ))}
                  {otherSources.length > 3 && (
                    <span className="text-ink-faint">
                      +{otherSources.length - 3} more
                    </span>
                  )}
                </div>
              )}

              {topicTags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {topicTags.slice(0, 4).map((t) => (
                    <span key={t} className="chip">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <BookmarkButton articleId={primary.id} initial={bookmarked} />
              <a
                href={primary.url as string}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-muted hover:text-ink"
                title="Open source"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function safeParse(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
