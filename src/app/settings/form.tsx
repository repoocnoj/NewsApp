"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { refreshArticlesAction } from "../actions";
import { saveSettingsAction } from "./actions";

export function SettingsForm({
  topics,
  sources,
  initial,
}: {
  topics: string[];
  sources: Array<{
    id: string;
    name: string;
    region: string;
    trustTier: string;
    perspectiveTags: string[];
  }>;
  initial: {
    topics: string[];
    preferredSources: string[];
    excludedSources: string[];
  };
}) {
  const router = useRouter();
  const [selectedTopics, setSelectedTopics] = useState<string[]>(initial.topics);
  const [preferredSources, setPreferredSources] = useState<string[]>(initial.preferredSources);
  const [excludedSources, setExcludedSources] = useState<string[]>(initial.excludedSources);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [refreshResult, setRefreshResult] = useState<string | null>(null);

  function toggle(list: string[], setter: (v: string[]) => void, id: string) {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
    setSaved(false);
  }

  function save() {
    start(async () => {
      await saveSettingsAction({
        topics: selectedTopics,
        preferredSources,
        excludedSources,
      });
      setSaved(true);
      router.refresh();
    });
  }

  function refresh() {
    setRefreshResult(null);
    startRefresh(async () => {
      try {
        const result = await refreshArticlesAction();
        if (result.fetched > 0) {
          setRefreshResult(
            `✓ Fetched ${result.fetched} new article${result.fetched === 1 ? "" : "s"}. Open the Feed to see them.`,
          );
        } else if (result.failed > 0) {
          setRefreshResult(
            `Fetched 0 new articles (${result.failed} feed error${result.failed === 1 ? "" : "s"}). Some publishers block RSS — try again later or check the logs.`,
          );
        } else {
          setRefreshResult(
            `No new articles from the active sources right now. Try again in a few minutes.`,
          );
        }
        router.refresh();
      } catch (err) {
        setRefreshResult(`Refresh failed: ${(err as Error).message}`);
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="text-lg font-semibold">Topics you follow</h2>
        <p className="text-sm text-ink-muted">These boost articles in your feed.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {topics.map((t) => {
            const on = selectedTopics.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggle(selectedTopics, setSelectedTopics, t)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                  on
                    ? "border-brand bg-brand/15 text-brand"
                    : "border-line text-ink-muted hover:bg-bg-elevated",
                )}
              >
                #{t}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-semibold">Sources</h2>
        <p className="text-sm text-ink-muted">
          Prefer sources you trust or exclude ones you don&rsquo;t want to see. State-affiliated
          sources are labeled so you can weigh them accordingly.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {sources.map((s) => {
            const preferred = preferredSources.includes(s.id);
            const excluded = excludedSources.includes(s.id);
            return (
              <div
                key={s.id}
                className={cn(
                  "rounded-xl border p-3 text-sm",
                  preferred
                    ? "border-brand bg-brand/10"
                    : excluded
                      ? "border-accent-warn/40 bg-accent-warn/5"
                      : "border-line bg-bg-subtle",
                )}
              >
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-ink-faint">
                  {s.region || "global"} · {s.trustTier}
                  {s.perspectiveTags.length ? ` · ${s.perspectiveTags.join(", ")}` : ""}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (excluded) setExcludedSources(excludedSources.filter((x) => x !== s.id));
                      toggle(preferredSources, setPreferredSources, s.id);
                    }}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs",
                      preferred
                        ? "bg-brand text-[#0a1220]"
                        : "border border-line text-ink-muted hover:text-ink",
                    )}
                  >
                    Prefer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (preferred) setPreferredSources(preferredSources.filter((x) => x !== s.id));
                      toggle(excludedSources, setExcludedSources, s.id);
                    }}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs",
                      excluded
                        ? "bg-accent-warn text-[#1a0a0a]"
                        : "border border-line text-ink-muted hover:text-ink",
                    )}
                  >
                    Exclude
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-semibold">Pull latest articles</h2>
        <p className="text-sm text-ink-muted">
          Fetch the newest articles from every active source with an open RSS feed.
          Several major publishers (Bloomberg, Foreign Affairs, AFP) require a licensed
          integration and are seeded with mock data only. Others (WSJ, NYT, FT, Economist)
          publish RSS but headlines and previews only — full article text is paywalled.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={refreshing}
            onClick={refresh}
            className="btn-ghost"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            {refreshing ? "Fetching…" : "Refresh articles now"}
          </button>
          {refreshResult && (
            <span className="text-sm text-ink-muted">{refreshResult}</span>
          )}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button type="button" disabled={pending} onClick={save} className="btn-primary">
          {pending ? "Saving…" : "Save changes"}
        </button>
        {saved && <span className="text-sm text-accent-ok">Saved ✓</span>}
      </div>
    </div>
  );
}
