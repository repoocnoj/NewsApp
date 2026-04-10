"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function toggleBookmarkAction(articleId: string) {
  const user = await requireUser();
  const existing = await db.bookmark.findUnique({
    where: { userId_articleId: { userId: user.id, articleId } },
  });
  if (existing) {
    await db.bookmark.delete({ where: { id: existing.id } });
    revalidatePath("/bookmarks");
    return { bookmarked: false };
  }
  await db.bookmark.create({ data: { userId: user.id, articleId } });
  revalidatePath("/bookmarks");
  return { bookmarked: true };
}
