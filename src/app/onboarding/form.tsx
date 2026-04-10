"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { savePreferencesAction } from "./actions";

type Topic = { id: string; label: string };
type Source = {
  id: string;
  name: string;
  region: string;
  trustTier: string;
  perspectiveTags: string[];
};
type SampleArticle = {
  id: string;
  headline: string;
  source: string;
  summaryShort: string;
  topicTags: string[];
};

export function OnboardingForm({
  topics,
  sources,
  sampleArticles,
  initial,
}: {
  topics: Topic[];
  sources: Source[];
  sampleArticles: SampleArticle[];
  initial: {
    topics: string[];
    preferredSources: string[];
    excludedSources: string[];
  };
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selectedTopics, setSelectedTopics] = useState<string[]>(initial.topics);
  const [preferredSources, setPreferredSources] = useState<string[]>(initial.preferredSources);
  const [excludedSources, setExcludedSources] = useState<string[]>(initial.excludedSources);
  const [likedArticles, setLikedArticles] = useState<string[]>([]);
  const [dislikedArticles, setDislikedArticles] = useState<string[]>([]);
  const [pending, start] = useTransition();

  function toggle(list: string[], setter: (v: string[]) => void, id: string) {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  const steps = [
    { title: "Choose topics", sub: "Pick at least two to start." },
    { title: "Your sources", sub: "Select sources you trust or want to exclude." },
    { title: "Tune with examples", sub: "Like or dislike a few articles to refine your feed." },
  ];

  const canNext =
    (step === 0 && selectedTopics.length >= 2) ||
    (step === 1 && preferredSources.length > 0) ||
    step === 2;

  function submit() {
    start(async () => {
      await savePreferencesAction({
        topics: selectedTopics,
        preferredSources,
        excludedSources,
        likedArticles,
        dislikedArticles,
      });
      router.push("/feed");
      router.refresh();
    });
  }

  return (
    <div className="card p-6">
      <div className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              i <= step ? "bg-brand" : "bg-line",
            )}
          />
        ))}
      </div>
      <div className="mb-1 text-xs uppercase tracking-wide text-ink-faint">
        Step {step + 1} of {steps.length}
      </div>
      <h2 className="text-xl font-semibold">{steps[step].title}</h2>
      <p className="mt-1 text-sm text-ink-muted">{steps[step].sub}</p>

      <div className="mt-6">
        {step === 0 && (
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => {
              const on = selectedTopics.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggle(selectedTopics, setSelectedTopics, t.id)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                    on
                      ? "border-brand bg-brand/15 text-brand"
                      : "border-line text-ink-muted hover:bg-bg-elevated",
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-2 sm:grid-cols-2">
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
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-ink-faint">
                        {s.region} · {s.trustTier}
                        {s.perspectiveTags.length ? ` · ${s.perspectiveTags.join(", ")}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs",
                        preferred
                          ? "bg-brand text-[#0a1220]"
                          : "border border-line text-ink-muted hover:text-ink",
                      )}
                      onClick={() => {
                        if (excluded) setExcludedSources(excludedSources.filter((x) => x !== s.id));
                        toggle(preferredSources, setPreferredSources, s.id);
                      }}
                    >
                      Prefer
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs",
                        excluded
                          ? "bg-accent-warn text-[#1a0a0a]"
                          : "border border-line text-ink-muted hover:text-ink",
                      )}
                      onClick={() => {
                        if (preferred) setPreferredSources(preferredSources.filter((x) => x !== s.id));
                        toggle(excludedSources, setExcludedSources, s.id);
                      }}
                    >
                      Exclude
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {sampleArticles.map((a) => {
              const liked = likedArticles.includes(a.id);
              const disliked = dislikedArticles.includes(a.id);
              return (
                <div
                  key={a.id}
                  className={cn(
                    "rounded-xl border p-4 text-sm",
                    liked
                      ? "border-brand bg-brand/10"
                      : disliked
                        ? "border-accent-warn/40 bg-accent-warn/5"
                        : "border-line bg-bg-subtle",
                  )}
                >
                  <div className="text-xs text-ink-faint">{a.source}</div>
                  <div className="mt-1 font-medium">{a.headline}</div>
                  <div className="mt-1 text-ink-muted">{a.summaryShort}</div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="btn-subtle text-xs"
                      onClick={() => {
                        if (disliked) setDislikedArticles(dislikedArticles.filter((x) => x !== a.id));
                        toggle(likedArticles, setLikedArticles, a.id);
                      }}
                    >
                      {liked ? "Liked" : "Like"}
                    </button>
                    <button
                      type="button"
                      className="btn-subtle text-xs"
                      onClick={() => {
                        if (liked) setLikedArticles(likedArticles.filter((x) => x !== a.id));
                        toggle(dislikedArticles, setDislikedArticles, a.id);
                      }}
                    >
                      {disliked ? "Disliked" : "Not for me"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep(step - 1)}
          className="btn-ghost"
        >
          Back
        </button>
        {step < steps.length - 1 ? (
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setStep(step + 1)}
            className="btn-primary"
          >
            Next
          </button>
        ) : (
          <button type="button" disabled={pending} onClick={submit} className="btn-primary">
            {pending ? "Saving…" : "Finish and open my feed"}
          </button>
        )}
      </div>
    </div>
  );
}
