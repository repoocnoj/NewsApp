"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  BookmarkCheck,
  Share2,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  MessageSquare,
  RotateCcw,
  List,
} from "lucide-react";
import { cn, formatRelative } from "@/lib/utils";
import { toggleBookmarkAction } from "@/app/article/[id]/actions";
import { signalArticleAction } from "@/app/actions";

export type SwipeArticle = {
  id: string;
  headline: string;
  summaryShort: string;
  summaryLong: string;
  url: string;
  publishedAt: string;
  imageUrl: string | null;
  topicTags: string[];
  sourceName: string;
  sourceTrustTier: string;
  bookmarked: boolean;
  liked: boolean;
  disliked: boolean;
};

type Decision =
  | { kind: "bookmark" }
  | { kind: "share" }
  | { kind: "skip" }
  | { kind: "like" }
  | { kind: "dislike" };

const SWIPE_THRESHOLD = 110; // px, horizontal commit distance

/**
 * Instagram-style swipe deck.
 *
 * Gestures:
 *   - Swipe RIGHT (or tap ❤️ right-edge button) → bookmark this article, advance
 *   - Swipe LEFT  (or tap ↗ left-edge button)  → share this article, advance
 *   - Thumbs up / Thumbs down buttons → feedback signal, advance
 *   - Tap the card body → open article detail
 *   - Tap the "Next" chevron → skip without signal
 *
 * Works with both touch (mobile) and mouse (desktop drag) events.
 * Keyboard shortcuts: ← share, → bookmark, ↑ like, ↓ dislike, space skip.
 */
export function SwipeDeck({
  articles,
  activeCategory,
}: {
  articles: SwipeArticle[];
  activeCategory: string;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [exit, setExit] = useState<
    | { dir: "left" | "right" | "up" | "down" }
    | null
  >(null);
  const [toast, setToast] = useState<{ label: string; tone: "ok" | "warn" | "info" } | null>(null);
  const [localState, setLocalState] = useState(() =>
    Object.fromEntries(
      articles.map((a) => [
        a.id,
        { bookmarked: a.bookmarked, liked: a.liked, disliked: a.disliked },
      ]),
    ),
  );
  const dragRef = useRef<{ startX: number; startY: number } | null>(null);

  const current = articles[index];
  const next = articles[index + 1];

  const flashToast = useCallback(
    (label: string, tone: "ok" | "warn" | "info" = "info") => {
      setToast({ label, tone });
      setTimeout(() => setToast(null), 1400);
    },
    [],
  );

  const commit = useCallback(
    (decision: Decision) => {
      if (!current) return;
      // Optimistic UI update + exit animation direction
      const dir: "left" | "right" | "up" | "down" =
        decision.kind === "share"
          ? "left"
          : decision.kind === "bookmark"
            ? "right"
            : decision.kind === "like"
              ? "up"
              : decision.kind === "dislike"
                ? "down"
                : "up";
      setExit({ dir });
      setDrag(null);

      // Fire the server action
      (async () => {
        try {
          if (decision.kind === "bookmark") {
            if (!localState[current.id]?.bookmarked) {
              const res = await toggleBookmarkAction(current.id);
              setLocalState((s) => ({
                ...s,
                [current.id]: { ...s[current.id], bookmarked: res.bookmarked },
              }));
              flashToast(res.bookmarked ? "Saved" : "Bookmark removed", "ok");
            } else {
              flashToast("Already saved", "info");
            }
          } else if (decision.kind === "share") {
            const shareData = {
              title: current.headline,
              text: current.summaryShort,
              url: current.url,
            };
            const nav = typeof navigator !== "undefined" ? (navigator as Navigator) : null;
            if (nav && typeof nav.share === "function") {
              try {
                await nav.share(shareData);
                flashToast("Shared", "ok");
              } catch {
                // user cancelled — not an error
              }
            } else if (nav && nav.clipboard && typeof nav.clipboard.writeText === "function") {
              await nav.clipboard.writeText(current.url);
              flashToast("Link copied", "ok");
            } else {
              flashToast("Sharing not supported", "warn");
            }
          } else if (decision.kind === "like") {
            await signalArticleAction(current.id, "like");
            setLocalState((s) => ({
              ...s,
              [current.id]: { ...s[current.id], liked: true, disliked: false },
            }));
            flashToast("More like this", "ok");
          } else if (decision.kind === "dislike") {
            await signalArticleAction(current.id, "dislike");
            setLocalState((s) => ({
              ...s,
              [current.id]: { ...s[current.id], liked: false, disliked: true },
            }));
            flashToast("Fewer like this", "info");
          }
        } catch (err) {
          flashToast("Action failed", "warn");
          console.error(err);
        }
      })();

      // Advance after a short exit animation
      setTimeout(() => {
        setExit(null);
        setIndex((i) => i + 1);
      }, 260);
    },
    [current, flashToast, localState],
  );

  // Pointer handlers (unified for touch and mouse)
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (exit) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY };
    setDrag({ x: 0, y: 0 });
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || exit) return;
    setDrag({
      x: e.clientX - dragRef.current.startX,
      y: e.clientY - dragRef.current.startY,
    });
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    dragRef.current = null;
    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      commit(dx > 0 ? { kind: "bookmark" } : { kind: "share" });
    } else {
      setDrag(null);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!current || exit) return;
      // Ignore key events inside inputs
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        commit({ kind: "bookmark" });
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        commit({ kind: "share" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        commit({ kind: "like" });
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        commit({ kind: "dislike" });
      } else if (e.key === " " || e.key.toLowerCase() === "n") {
        e.preventDefault();
        commit({ kind: "skip" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, exit, commit]);

  const exhausted = !current;

  // Transform the current card based on drag position + exit animation
  const cardStyle = useMemo<React.CSSProperties>(() => {
    if (exit) {
      const distance = 600;
      const transforms: Record<string, string> = {
        left: `translateX(-${distance}px) rotate(-12deg)`,
        right: `translateX(${distance}px) rotate(12deg)`,
        up: `translateY(-${distance}px) rotate(-6deg)`,
        down: `translateY(${distance}px) rotate(6deg)`,
      };
      return {
        transform: transforms[exit.dir],
        opacity: 0,
        transition: "transform 260ms ease-out, opacity 260ms ease-out",
      };
    }
    if (drag) {
      const rot = Math.max(-18, Math.min(18, drag.x / 12));
      return {
        transform: `translate(${drag.x}px, ${drag.y * 0.2}px) rotate(${rot}deg)`,
        transition: "none",
      };
    }
    return {
      transform: "translate(0,0) rotate(0)",
      transition: "transform 180ms ease-out",
    };
  }, [drag, exit]);

  const decisionHint = useMemo(() => {
    if (!drag) return null;
    if (drag.x > SWIPE_THRESHOLD * 0.5) return "bookmark" as const;
    if (drag.x < -SWIPE_THRESHOLD * 0.5) return "share" as const;
    return null;
  }, [drag]);

  const cs = current ? localState[current.id] : null;

  return (
    <div className="relative mx-auto flex h-[calc(100dvh-3.5rem)] max-w-xl flex-col overflow-hidden px-4 py-4 sm:py-6">
      {/* Top bar: category context + view toggle */}
      <div className="mb-3 flex items-center justify-between text-xs text-ink-muted">
        <div className="flex items-center gap-1">
          <span className="label text-ink-faint">Swipe view</span>
          {activeCategory !== "top" && (
            <span className="chip-brand ml-2">#{activeCategory}</span>
          )}
        </div>
        <Link
          href={`/feed${activeCategory !== "top" ? `?category=${activeCategory}` : ""}`}
          className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-ink-muted hover:text-ink"
          title="Switch to list view"
        >
          <List className="h-3.5 w-3.5" /> List view
        </Link>
      </div>

      {/* Card stack area */}
      <div className="relative flex-1">
        {exhausted ? (
          <EmptyState onRestart={() => setIndex(0)} router={router} />
        ) : (
          <>
            {/* Next card (peek underneath) */}
            {next && <NextCardPreview article={next} />}

            {/* Current card */}
            <div
              className="absolute inset-0 touch-none select-none"
              style={cardStyle}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => {
                dragRef.current = null;
                setDrag(null);
              }}
            >
              <SwipeCard
                article={current}
                bookmarked={cs?.bookmarked ?? false}
                hint={decisionHint}
              />
            </div>
          </>
        )}
      </div>

      {/* Action bar */}
      {!exhausted && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <ActionButton
            label="Share"
            onClick={() => commit({ kind: "share" })}
            tone="neutral"
          >
            <Share2 className="h-5 w-5" />
          </ActionButton>
          <ActionButton
            label="Not for me"
            onClick={() => commit({ kind: "dislike" })}
            tone="warn"
            active={cs?.disliked}
          >
            <ThumbsDown className="h-5 w-5" />
          </ActionButton>
          <ActionButton
            label="More like this"
            onClick={() => commit({ kind: "like" })}
            tone="ok"
            active={cs?.liked}
          >
            <ThumbsUp className="h-5 w-5" />
          </ActionButton>
          <ActionButton
            label={cs?.bookmarked ? "Saved" : "Save"}
            onClick={() => commit({ kind: "bookmark" })}
            tone="brand"
            active={cs?.bookmarked}
          >
            {cs?.bookmarked ? (
              <BookmarkCheck className="h-5 w-5" />
            ) : (
              <Bookmark className="h-5 w-5" />
            )}
          </ActionButton>
        </div>
      )}

      {/* Progress strip */}
      {!exhausted && (
        <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-ink-faint">
          <span>{index + 1}</span>
          <span className="h-1 w-24 overflow-hidden rounded-full bg-line">
            <span
              className="block h-full bg-brand transition-all"
              style={{
                width: `${((index + 1) / Math.max(articles.length, 1)) * 100}%`,
              }}
            />
          </span>
          <span>{articles.length}</span>
        </div>
      )}

      {/* Hint text */}
      {!exhausted && (
        <div className="mt-1 text-center text-[10px] uppercase tracking-wide text-ink-faint">
          Swipe → save · Swipe ← share · ↑↓ for feedback · Tap to open
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-medium shadow-soft",
            toast.tone === "ok" && "bg-accent-ok/15 text-accent-ok border border-accent-ok/30",
            toast.tone === "warn" && "bg-accent-warn/15 text-accent-warn border border-accent-warn/30",
            toast.tone === "info" && "bg-bg-elevated text-ink border border-line",
          )}
        >
          {toast.label}
        </div>
      )}
    </div>
  );
}

/* ---------- Sub-components ---------- */

function SwipeCard({
  article,
  bookmarked,
  hint,
}: {
  article: SwipeArticle;
  bookmarked: boolean;
  hint: "bookmark" | "share" | null;
}) {
  return (
    <div className="card relative flex h-full flex-col overflow-hidden">
      {/* Hint badges that appear during drag */}
      {hint === "bookmark" && (
        <div className="absolute right-4 top-4 z-10 rotate-12 rounded-lg border-2 border-accent-ok bg-accent-ok/15 px-3 py-1 text-sm font-bold uppercase text-accent-ok">
          Save
        </div>
      )}
      {hint === "share" && (
        <div className="absolute left-4 top-4 z-10 -rotate-12 rounded-lg border-2 border-brand bg-brand/15 px-3 py-1 text-sm font-bold uppercase text-brand">
          Share
        </div>
      )}

      <Link href={`/article/${article.id}`} className="relative block">
        {article.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.imageUrl}
            alt=""
            className="h-56 w-full object-cover sm:h-72"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-56 w-full items-center justify-center bg-gradient-to-br from-bg-elevated to-bg-subtle sm:h-72">
            <div className="text-6xl opacity-20">📰</div>
          </div>
        )}
        {bookmarked && (
          <div className="absolute right-3 top-3 rounded-full bg-brand p-1.5 text-[#0a1220] shadow-soft">
            <BookmarkCheck className="h-4 w-4" />
          </div>
        )}
      </Link>

      <div className="flex min-h-0 flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-faint">
          <span className="font-medium text-ink-muted">{article.sourceName}</span>
          {article.sourceTrustTier === "state-affiliated" && (
            <span className="chip text-accent-warn">state-affiliated</span>
          )}
          <span>·</span>
          <span>{formatRelative(article.publishedAt)}</span>
        </div>
        <Link href={`/article/${article.id}`} className="mt-2 block">
          <h2 className="text-xl font-semibold leading-tight sm:text-2xl">
            {article.headline}
          </h2>
        </Link>
        <p className="mt-3 line-clamp-5 flex-1 text-sm text-ink-muted sm:line-clamp-6">
          {article.summaryLong || article.summaryShort}
        </p>
        {article.topicTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {article.topicTags.map((t) => (
              <span key={t} className="chip">
                #{t}
              </span>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3 text-xs">
          <Link
            href={`/article/${article.id}`}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-ink-muted hover:text-ink"
          >
            <MessageSquare className="h-3.5 w-3.5" /> Ask AI
          </Link>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-ink-muted hover:text-ink"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Source
          </a>
        </div>
      </div>
    </div>
  );
}

function NextCardPreview({ article }: { article: SwipeArticle }) {
  return (
    <div
      className="absolute inset-0 scale-[0.96] opacity-60"
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    >
      <div className="card h-full overflow-hidden">
        {article.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.imageUrl}
            alt=""
            className="h-56 w-full object-cover sm:h-72"
          />
        ) : (
          <div className="flex h-56 w-full items-center justify-center bg-gradient-to-br from-bg-elevated to-bg-subtle sm:h-72" />
        )}
        <div className="p-5">
          <div className="text-xs text-ink-faint">{article.sourceName}</div>
          <div className="mt-2 line-clamp-2 text-lg font-semibold">{article.headline}</div>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  children,
  onClick,
  tone,
  active,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  tone: "ok" | "warn" | "brand" | "neutral";
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all hover:scale-105 active:scale-95",
        tone === "ok" &&
          (active
            ? "border-accent-ok bg-accent-ok/20 text-accent-ok"
            : "border-line text-ink-muted hover:border-accent-ok/60 hover:text-accent-ok"),
        tone === "warn" &&
          (active
            ? "border-accent-warn bg-accent-warn/20 text-accent-warn"
            : "border-line text-ink-muted hover:border-accent-warn/60 hover:text-accent-warn"),
        tone === "brand" &&
          (active
            ? "border-brand bg-brand/20 text-brand"
            : "border-line text-ink-muted hover:border-brand/60 hover:text-brand"),
        tone === "neutral" && "border-line text-ink-muted hover:border-brand/40 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({
  onRestart,
  router,
}: {
  onRestart: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="card max-w-sm p-8 text-center">
        <div className="mx-auto mb-3 text-5xl">🎉</div>
        <h2 className="text-xl font-semibold">You&rsquo;re caught up</h2>
        <p className="mt-1 text-sm text-ink-muted">
          No more articles in this view. Refresh to pull new coverage, or jump back to the
          top of the deck.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={onRestart} className="btn-primary">
            <RotateCcw className="h-4 w-4" /> Start over
          </button>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="btn-ghost"
          >
            Fetch latest
          </button>
          <Link href="/feed" className="btn-ghost">
            <List className="h-4 w-4" /> List view
          </Link>
        </div>
      </div>
    </div>
  );
}
