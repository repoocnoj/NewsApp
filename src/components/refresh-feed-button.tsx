"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { refreshArticlesAction } from "@/app/actions";
import { formatRelative, cn } from "@/lib/utils";

/**
 * Prominent refresh button for the Feed page. Triggers a live RSS pull
 * across every active source and reloads the feed when done.
 *
 * Real RSS fetches take 10–30 seconds, so the button stays in its
 * "fetching" state for long enough that the user should not click twice.
 * We guard with useTransition anyway.
 */
export function RefreshFeedButton({
  lastRefreshedAt,
}: {
  lastRefreshedAt?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<
    | { kind: "idle" }
    | { kind: "success"; fetched: number }
    | { kind: "empty" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  // Clear the result banner after a few seconds.
  useEffect(() => {
    if (result.kind === "idle") return;
    const t = setTimeout(() => setResult({ kind: "idle" }), 6000);
    return () => clearTimeout(t);
  }, [result.kind]);

  function refresh() {
    setResult({ kind: "idle" });
    start(async () => {
      try {
        const res = await refreshArticlesAction();
        if (res.fetched > 0) {
          setResult({ kind: "success", fetched: res.fetched });
        } else if (res.failed > 0) {
          setResult({
            kind: "error",
            message: `${res.failed} feed${res.failed === 1 ? "" : "s"} errored. Try again in a moment.`,
          });
        } else {
          setResult({ kind: "empty" });
        }
        router.refresh();
      } catch (err) {
        setResult({ kind: "error", message: (err as Error).message });
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end sm:gap-3">
      <div className="flex flex-col text-xs text-ink-faint sm:items-end">
        {lastRefreshedAt && !pending && result.kind === "idle" && (
          <span>Last updated {formatRelative(lastRefreshedAt)}</span>
        )}
        {pending && (
          <span className="text-ink-muted">Fetching live RSS…</span>
        )}
        {result.kind === "success" && (
          <span className="flex items-center gap-1 text-accent-ok">
            <CheckCircle2 className="h-3 w-3" />
            Fetched {result.fetched} new article{result.fetched === 1 ? "" : "s"}
          </span>
        )}
        {result.kind === "empty" && (
          <span className="text-ink-muted">No new articles right now</span>
        )}
        {result.kind === "error" && (
          <span className="flex items-center gap-1 text-accent-warn">
            <AlertTriangle className="h-3 w-3" />
            {result.message}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={refresh}
        disabled={pending}
        className={cn(
          "btn-primary min-w-[130px] shrink-0",
          pending && "cursor-wait opacity-80",
        )}
        title="Pull fresh articles from every active RSS source"
      >
        <RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} />
        {pending ? "Refreshing…" : "Refresh feed"}
      </button>
    </div>
  );
}
