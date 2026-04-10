"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FeedCategory {
  slug: string;
  label: string;
  count: number;
}

export interface TrendingChip {
  label: string;
  count: number;
}

/**
 * Horizontally-scrollable category bar for the top of the Feed page
 * plus a "trending now" row of named-entity chips. Both drive the
 * feed filter via the `category` / `q` search params on /feed.
 */
export function FeedFilters({
  categories,
  activeCategory,
  trending,
}: {
  categories: FeedCategory[];
  activeCategory: string;
  trending: TrendingChip[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function categoryHref(slug: string) {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (slug === "top") params.delete("category");
    else params.set("category", slug);
    const qs = params.toString();
    return `/feed${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-3">
      {/* Category chips */}
      <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 scrollbar-thin">
        {categories.map((cat) => {
          const active = activeCategory === cat.slug;
          return (
            <Link
              key={cat.slug}
              href={categoryHref(cat.slug)}
              scroll={false}
              className={cn(
                "snap-start whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                active
                  ? "border-brand bg-brand/15 text-brand"
                  : "border-line text-ink-muted hover:bg-bg-elevated hover:text-ink",
              )}
            >
              <span>{cat.label}</span>
              {cat.count > 0 && (
                <span className={cn("ml-1.5 text-xs", active ? "text-brand/80" : "text-ink-faint")}>
                  {cat.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Trending entity chips */}
      {trending.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-ink-faint">
            <TrendingUp className="h-3.5 w-3.5" />
            Trending
          </div>
          <div className="flex flex-1 flex-wrap gap-1.5">
            {trending.map((t) => (
              <Link
                key={t.label}
                href={`/search?q=${encodeURIComponent(t.label)}`}
                className="rounded-full border border-line bg-bg-subtle px-2.5 py-0.5 text-xs text-ink-muted hover:border-brand/40 hover:text-ink"
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
