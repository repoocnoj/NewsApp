"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

/**
 * Top-level error boundary. Catches any unhandled error thrown by a
 * server component or during rendering and shows the real message
 * instead of Next.js's opaque digest screen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", {
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
            <h1 className="text-xl font-semibold">Something broke</h1>
            <p className="mt-1 text-sm text-ink-muted">
              We&rsquo;ve logged the details server-side. Most of the time a reload fixes it.
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
