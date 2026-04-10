"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";

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
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { reply: string };
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Something went wrong generating a response. Check your AI provider config or try again.",
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
    <div className="card flex h-[520px] flex-col">
      <div className="flex items-center gap-2 border-b border-line p-4">
        <Sparkles className="h-4 w-4 text-brand" />
        <div>
          <div className="text-sm font-semibold">Ask about this story</div>
          <div className="text-xs text-ink-faint line-clamp-1">{articleHeadline}</div>
        </div>
      </div>
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
