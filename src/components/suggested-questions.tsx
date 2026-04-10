"use client";

import { Lightbulb } from "lucide-react";

export function SuggestedQuestions({
  articleId,
  questions,
}: {
  articleId: string;
  questions: string[];
}) {
  if (questions.length === 0) return null;
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-accent" />
        <div className="text-sm font-semibold">Suggested questions</div>
      </div>
      <div className="mt-3 space-y-2">
        {questions.map((q, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              const ask = (window as any).__newsapp_ask__;
              if (typeof ask === "function") ask(q);
            }}
            className="block w-full rounded-xl border border-line bg-bg-subtle px-3 py-2 text-left text-sm text-ink-muted hover:border-brand/40 hover:bg-bg-elevated hover:text-ink"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
