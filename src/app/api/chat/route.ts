import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ai } from "@/lib/ai";
import type { ChatMessage } from "@/lib/ai/types";

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

  // Gather related articles to ground the chat
  const relationships = await db.articleRelationship.findMany({
    where: { fromArticleId: article.id },
    include: { toArticle: { include: { source: true } } },
    take: 8,
  });
  const related = relationships.map((r) => ({
    source: r.toArticle.source.name,
    headline: r.toArticle.headline,
    url: r.toArticle.url,
    summary: r.toArticle.summaryShort,
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
