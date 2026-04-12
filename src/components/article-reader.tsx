"use client";

import { useState, useRef, useEffect } from "react";
import {
  FileText,
  BarChart3,
  Globe,
  ExternalLink,
  AlertTriangle,
  X,
  Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "analysis" | "read" | "source";

/**
 * Tabbed view for the article detail page:
 *
 *   Analysis — AI summary, related coverage, synthesis, timeline (default)
 *   Read     — Full extracted article text in a comfortable reader layout
 *   Source   — Embedded iframe attempt of the original publisher URL
 *
 * The "Source" tab includes:
 *   - An iframe loading the article URL
 *   - A timeout-based fallback: if the iframe shows nothing after 5s
 *     (many publishers set X-Frame-Options: DENY), we surface a clear
 *     message explaining why and offering "Open in new tab"
 *   - A note about third-party cookies and subscription limitations
 */
export function ArticleReader({
  articleUrl,
  articleText,
  sourceName,
  analysisContent,
}: {
  articleUrl: string;
  articleText: string;
  sourceName: string;
  analysisContent: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("analysis");

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "analysis", label: "Analysis", icon: <BarChart3 className="h-4 w-4" /> },
    { id: "read", label: "Read", icon: <FileText className="h-4 w-4" /> },
    { id: "source", label: "Source", icon: <Globe className="h-4 w-4" /> },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-6 flex items-center gap-1 rounded-xl border border-line bg-bg-subtle p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-bg-elevated text-ink shadow-sm"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "analysis" && <div>{analysisContent}</div>}
      {tab === "read" && (
        <ReaderView
          articleText={articleText}
          articleUrl={articleUrl}
          sourceName={sourceName}
        />
      )}
      {tab === "source" && (
        <SourceView articleUrl={articleUrl} sourceName={sourceName} />
      )}
    </div>
  );
}

/* ──────── Reader View ──────── */

function ReaderView({
  articleText,
  articleUrl,
  sourceName,
}: {
  articleText: string;
  articleUrl: string;
  sourceName: string;
}) {
  const isSubstantial = articleText.length > 800;
  const paragraphs = articleText
    .split(/\n{2,}/)
    .filter((p) => p.trim().length > 0);

  return (
    <div className="card p-6 sm:p-8">
      {!isSubstantial && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-dashed border-line bg-bg-subtle p-3 text-xs text-ink-muted">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div>
            <span className="font-medium text-ink">Preview only.</span> This source
            provides a limited excerpt through its RSS feed. The full article is
            available at the publisher&rsquo;s website.
          </div>
        </div>
      )}

      <div className="prose-reader mx-auto max-w-2xl">
        {paragraphs.length > 0 ? (
          paragraphs.map((p, i) => (
            <p
              key={i}
              className="mb-5 font-serif text-[17px] leading-[1.75] text-ink"
            >
              {p.trim()}
            </p>
          ))
        ) : (
          <p className="font-serif text-[17px] leading-[1.75] text-ink">
            {articleText}
          </p>
        )}
      </div>

      <div className="mt-8 border-t border-line pt-5 text-center">
        <a
          href={articleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
        >
          <ExternalLink className="h-4 w-4" /> Continue reading at {sourceName}
        </a>
        <div className="mt-2 text-xs text-ink-faint">
          Opens in a new tab. If you have a subscription, you&rsquo;ll see the full article.
        </div>
      </div>
    </div>
  );
}

/* ──────── Source (iframe) View ──────── */

function SourceView({
  articleUrl,
  sourceName,
}: {
  articleUrl: string;
  sourceName: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "blocked">(
    "loading",
  );
  const [fullscreen, setFullscreen] = useState(false);

  // Many publishers set X-Frame-Options: DENY. We can't detect this
  // reliably from JS, but we CAN show a loading state and after a
  // timeout assume it's blocked if the iframe is still blank.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (status === "loading") setStatus("blocked");
    }, 8000);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <div>
      <div className="mb-3 flex items-start gap-2 rounded-xl border border-dashed border-line bg-bg-subtle p-3 text-xs text-ink-muted">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <div>
          <span className="font-medium text-ink">Embedded source view.</span> Many
          publishers block embedding. If the page doesn&rsquo;t load below, use
          &ldquo;Open in new tab&rdquo;. Note: browser privacy settings prevent
          this view from sharing your subscription login — for paywalled sites,
          opening in a new tab gives the best experience.
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mb-3">
        <a
          href={articleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary text-sm"
        >
          <ExternalLink className="h-4 w-4" /> Open in new tab
        </a>
        <button
          onClick={() => setFullscreen((v) => !v)}
          className="btn-ghost text-sm"
        >
          <Maximize2 className="h-4 w-4" />
          {fullscreen ? "Exit fullscreen" : "Fullscreen"}
        </button>
      </div>

      {status === "blocked" && (
        <div className="card p-8 text-center">
          <Globe className="mx-auto h-8 w-8 text-ink-faint" />
          <h3 className="mt-3 font-semibold">
            {sourceName} doesn&rsquo;t allow embedding
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            This publisher sets security headers that prevent their pages from
            loading inside other apps. This is standard practice for most major
            news outlets.
          </p>
          <a
            href={articleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-4"
          >
            <ExternalLink className="h-4 w-4" /> Read at {sourceName}
          </a>
        </div>
      )}

      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-line bg-white",
          status === "blocked" && "hidden",
          fullscreen &&
            "fixed inset-0 z-50 rounded-none border-none",
        )}
      >
        {fullscreen && (
          <div className="flex items-center justify-between bg-bg-subtle px-4 py-2 text-sm">
            <span className="truncate text-ink-muted">{articleUrl}</span>
            <button
              onClick={() => setFullscreen(false)}
              className="ml-2 rounded-lg border border-line p-1 text-ink-muted hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={articleUrl}
          title={`Article from ${sourceName}`}
          className={cn(
            "w-full",
            fullscreen ? "h-[calc(100dvh-2.5rem)]" : "h-[75vh] min-h-[500px]",
          )}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          loading="lazy"
          onLoad={() => {
            if (status === "loading") setStatus("loaded");
          }}
        />
      </div>

      {status === "loading" && (
        <div className="mt-3 text-center text-sm text-ink-muted">
          Loading {sourceName}...
        </div>
      )}
    </div>
  );
}
