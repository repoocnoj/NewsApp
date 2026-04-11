"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function ArticleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[article error]", {
      name: error.name,
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="container max-w-2xl py-16">
      <div className="card p-8">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent-warn" />
          <div>
            <h1 className="text-xl font-semibold">Couldn&rsquo;t load this article</h1>
            <p className="mt-1 text-sm text-ink-muted">
              The error has been logged server-side. Try reloading — AI enrichment
              can occasionally hit a rate limit or a provider hiccup.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-line bg-bg-subtle p-4">
          <div className="label text-accent-warn">Error details</div>
          <div className="mt-2 font-mono text-xs text-ink-muted whitespace-pre-wrap break-words">
            {error.message || "(no message)"}
          </div>
          {error.digest && (
            <div className="mt-2 text-xs text-ink-faint">
              digest: <code>{error.digest}</code>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button onClick={() => reset()} className="btn-primary">
            <RotateCcw className="h-4 w-4" /> Try again
          </button>
          <Link href="/feed" className="btn-ghost">
            <Home className="h-4 w-4" /> Back to feed
          </Link>
        </div>
      </div>
    </div>
  );
}
