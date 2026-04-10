"use client";

import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toggleBookmarkAction } from "@/app/article/[id]/actions";
import { cn } from "@/lib/utils";

export function BookmarkButton({
  articleId,
  initial,
  size = "sm",
}: {
  articleId: string;
  initial: boolean;
  size?: "sm" | "md";
}) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();

  function handle() {
    start(async () => {
      const res = await toggleBookmarkAction(articleId);
      setOn(res.bookmarked);
    });
  }
  const dim = size === "md" ? "h-9 w-9" : "h-8 w-8";
  const icon = size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <button
      onClick={handle}
      disabled={pending}
      aria-pressed={on}
      title={on ? "Remove bookmark" : "Save article"}
      className={cn(
        "inline-flex items-center justify-center rounded-lg border transition-colors",
        dim,
        on ? "border-brand bg-brand/15 text-brand" : "border-line text-ink-muted hover:text-ink",
      )}
    >
      {on ? <BookmarkCheck className={icon} /> : <Bookmark className={icon} />}
    </button>
  );
}
