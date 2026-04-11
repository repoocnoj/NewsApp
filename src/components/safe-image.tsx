"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Client-side image wrapper with onError fallback. Must be a client
 * component — `onError` handlers cannot be passed to DOM elements from
 * Server Components in Next.js 15 (the render will throw with the
 * generic "An error occurred in the Server Components render" message,
 * which is exactly what NewsApp was seeing on /feed with real RSS
 * articles).
 *
 * When the image fails to load, we hide it gracefully — the parent
 * container's size stays so the layout doesn't shift.
 */
export function SafeImage({
  src,
  alt = "",
  className,
  loading = "lazy",
  onLoadFallback,
}: {
  src: string;
  alt?: string;
  className?: string;
  loading?: "lazy" | "eager";
  /** Optional content to render in place when the image fails to load */
  onLoadFallback?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return onLoadFallback ? (
      <>{onLoadFallback}</>
    ) : (
      <div
        className={cn(
          "flex items-center justify-center bg-gradient-to-br from-bg-elevated to-bg-subtle",
          className,
        )}
        aria-hidden="true"
      >
        <span className="text-3xl opacity-20">📰</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={loading}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
