"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Error boundary for /feed. Shows the real error message + stack
 * instead of Next.js's opaque digest screen. Safe to ship — error
 * details are never rendered unless you're on your own app.
 */
export default function FeedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaces the error in Vercel function logs with the digest, so
    // you can correlate what the user sees with the server-side stack.
    console.error("[feed error]", {
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
            <h1 className="text-xl font-semibold">Something broke loading your feed</h1>
            <p className="mt-1 text-sm text-ink-muted">
              The error has been logged server-side. Try reloading — most of the time
              it&rsquo;s a transient DB or provider hiccup.
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
            Reset to top stories
          </Link>
          <Link href="/settings" className="btn-ghost">
            Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
