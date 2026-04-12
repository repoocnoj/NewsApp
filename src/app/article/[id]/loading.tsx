/**
 * Instant loading skeleton shown during navigation to /article/[id].
 * This renders BEFORE any server component data fetching starts, so
 * the user sees immediate visual feedback when they click an article
 * in the feed. Replaced by the real page once the fast DB query
 * completes (~200ms).
 */
export default function ArticleLoading() {
  return (
    <div className="container grid gap-6 py-6 sm:py-8 lg:grid-cols-[1fr_380px] lg:gap-8">
      <div className="min-w-0 space-y-6">
        {/* Skeleton header */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-4 w-16 animate-pulse rounded bg-bg-elevated" />
            <div className="h-4 w-24 animate-pulse rounded bg-bg-elevated" />
            <div className="h-4 w-16 animate-pulse rounded bg-bg-elevated" />
          </div>
          <div className="h-9 w-4/5 animate-pulse rounded-lg bg-bg-elevated" />
          <div className="h-6 w-2/5 animate-pulse rounded-lg bg-bg-elevated" />
          <div className="flex gap-2 pt-2">
            <div className="h-9 w-36 animate-pulse rounded-xl bg-bg-elevated" />
            <div className="h-9 w-9 animate-pulse rounded-xl bg-bg-elevated" />
            <div className="h-9 w-20 animate-pulse rounded-xl bg-bg-elevated" />
          </div>
        </div>

        {/* Skeleton hero image */}
        <div className="h-56 animate-pulse rounded-2xl bg-bg-elevated sm:h-72" />

        {/* Skeleton article preview */}
        <div className="space-y-2">
          <div className="h-5 w-28 animate-pulse rounded bg-bg-elevated" />
          <div className="card p-5">
            <div className="space-y-3">
              <div className="h-4 w-full animate-pulse rounded bg-bg-elevated" />
              <div className="h-4 w-full animate-pulse rounded bg-bg-elevated" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-bg-elevated" />
              <div className="h-4 w-full animate-pulse rounded bg-bg-elevated" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-bg-elevated" />
            </div>
          </div>
        </div>

        {/* Skeleton AI sections */}
        <AIAnalysisSkeleton />
      </div>
      <aside className="space-y-6">
        {/* Skeleton chat panel */}
        <div className="card h-[min(70vh,560px)] min-h-[420px] animate-pulse" />
      </aside>
    </div>
  );
}

/** Reusable skeleton for the AI-powered sections */
export function AIAnalysisSkeleton() {
  return (
    <div className="space-y-6">
      {["AI summary", "Related coverage", "Cross-source analysis"].map(
        (label) => (
          <div key={label} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 animate-pulse rounded bg-bg-elevated" />
              <div className="h-5 w-40 animate-pulse rounded bg-bg-elevated" />
            </div>
            <div className="card p-5">
              <div className="space-y-3">
                <div className="h-4 w-full animate-pulse rounded bg-bg-elevated" />
                <div className="h-4 w-5/6 animate-pulse rounded bg-bg-elevated" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-bg-elevated" />
              </div>
            </div>
          </div>
        ),
      )}
    </div>
  );
}
