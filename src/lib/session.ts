import { cookies } from "next/headers";
import { db } from "@/lib/db";

const COOKIE = "newsapp_uid";

/**
 * Minimal dev-friendly session layer.
 * In production, swap this for Auth.js / NextAuth; the app only reads the
 * current user through `getCurrentUser()` so wiring a real provider in is
 * a small surface-area change.
 */
export async function getCurrentUser() {
  const uid = (await cookies()).get(COOKIE)?.value;
  if (!uid) return null;
  const user = await db.user.findUnique({
    where: { id: uid },
    include: { preference: true },
  });
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }
  return user;
}

export async function setSessionUserId(userId: string) {
  (await cookies()).set(COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // 30 days
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  (await cookies()).set(COOKIE, "", { path: "/", maxAge: 0 });
}
