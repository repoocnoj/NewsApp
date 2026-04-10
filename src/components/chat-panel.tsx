"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, AlertTriangle } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

export function ChatPanel({
  articleId,
  articleHeadline,
}: {
  articleId: string;
  articleHeadline: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [lastProvider, setLastProvider] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send(question?: string) {
    const content = (question ?? input).trim();
    if (!content || pending) return;
    setInput("");
    const nextHistory: Message[] = [...messages, { role: "user", content }];
    setMessages(nextHistory);
    setPending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, message: content, history: messages }),
      });
      if (!res.ok) {
        const errorBody = (await res.json().catch(() => null)) as
          | { error?: string; detail?: string; provider?: string; hint?: string }
          | null;
        throw new Error(
          errorBody?.detail
            ? `${errorBody.error ?? "error"}: ${errorBody.detail}${
                errorBody.hint ? ` — ${errorBody.hint}` : ""
              }`
            : "Request failed",
        );
      }
      const data = (await res.json()) as { reply: string; provider?: string };
      setLastProvider(data.provider ?? null);
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `Something went wrong generating a response. ${
            (err as Error).message
          }`,
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  // Expose a global hook so SuggestedQuestions can post into the chat
  useEffect(() => {
    (window as any).__newsapp_ask__ = (q: string) => send(q);
    return () => {
      delete (window as any).__newsapp_ask__;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, pending]);

  return (
    <div className="card flex h-[min(70vh,560px)] min-h-[420px] flex-col">
      <div className="flex items-center gap-2 border-b border-line p-4">
        <Sparkles className="h-4 w-4 text-brand" />
        <div className="flex-1">
          <div className="text-sm font-semibold">Ask about this story</div>
          <div className="text-xs text-ink-faint line-clamp-1">{articleHeadline}</div>
        </div>
      </div>
      {lastProvider === "mock" && (
        <div className="flex items-start gap-2 border-b border-accent-warn/30 bg-accent-warn/5 px-4 py-2 text-xs text-accent-warn">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Answered by the mock provider, not a real model. Hit{" "}
            <code className="rounded bg-bg-elevated px-1">/api/admin/ai-test</code> to
            diagnose why the Anthropic/OpenAI provider fell back.
          </span>
        </div>
      )}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        {messages.length === 0 && (
          <div className="text-ink-muted">
            Ground your questions in the article and related coverage. Try: &ldquo;What is
            corroborated across sources?&rdquo;, &ldquo;What is disputed?&rdquo;, or
            &ldquo;Give me the historical context.&rdquo;
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-6 rounded-xl bg-brand/15 p-3 text-ink"
                : "mr-6 rounded-xl border border-line bg-bg-subtle p-3 text-ink whitespace-pre-wrap"
            }
          >
            {m.content}
          </div>
        ))}
        {pending && (
          <div className="mr-6 rounded-xl border border-line bg-bg-subtle p-3 text-ink-muted">
            Thinking…
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-2 border-t border-line p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about this story…"
          className="input"
        />
        <button type="submit" disabled={pending} className="btn-primary h-9 w-9 !px-0">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
