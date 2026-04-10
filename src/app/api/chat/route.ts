import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ai } from "@/lib/ai";
import { findRelatedArticles } from "@/lib/article-enrich";
import type { ChatMessage } from "@/lib/ai/types";

export const maxDuration = 60;

const BodySchema = z.object({
  articleId: z.string().min(1),
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .max(20)
    .default([]),
});

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request", details: parsed.error.flatten() }, { status: 400 });
  }
  const { articleId, message, history } = parsed.data;

  const article = await db.article.findUnique({
    where: { id: articleId },
    include: { source: true },
  });
  if (!article) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Dynamically find related coverage across other sources so the chat
  // answer is grounded in what multiple outlets are saying — not just
  // pre-seeded relationships.
  const relatedSet = await findRelatedArticles(article, { limit: 6 });
  const related = [...relatedSet.related, ...relatedSet.contrarian].map((r) => ({
    source: r.article.source.name,
    headline: r.article.headline,
    url: r.article.url,
    summary: r.article.summaryShort || r.article.summaryLong,
  }));

  // Ensure a persistent conversation so we can reconstruct later
  let conversation = await db.conversation.findFirst({
    where: { userId: user.id, articleId: article.id },
    orderBy: { createdAt: "desc" },
  });
  if (!conversation) {
    conversation = await db.conversation.create({
      data: { userId: user.id, articleId: article.id },
    });
  }

  await db.message.create({
    data: { conversationId: conversation.id, role: "user", content: message },
  });

  const reply = await ai.chatOverArticle({
    article: {
      headline: article.headline,
      source: article.source.name,
      summary: article.summaryLong || article.summaryShort,
      text: article.articleText || article.previewText || "",
      url: article.url,
    },
    related,
    history: history as ChatMessage[],
    userMessage: message,
  });

  await db.message.create({
    data: { conversationId: conversation.id, role: "assistant", content: reply },
  });

  return NextResponse.json({ reply });
}
