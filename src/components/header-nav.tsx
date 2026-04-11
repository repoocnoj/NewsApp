"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/feed", label: "Feed" },
  { href: "/swipe", label: "Swipe" },
  { href: "/search", label: "Search" },
  { href: "/bookmarks", label: "Saved" },
  { href: "/settings", label: "Settings" },
];

export function HeaderNav({
  user,
}: {
  user: { name: string | null; email: string | null } | null;
}) {
  const pathname = usePathname() || "";
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  if (!user) {
    return (
      <nav className="flex items-center gap-1">
        <Link href="/signin" className="btn-ghost">
          Sign in
        </Link>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-1">
      {/* Desktop nav */}
      <div className="hidden items-center gap-1 md:flex">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition-colors",
              isActive(item.href)
                ? "bg-bg-elevated text-ink"
                : "text-ink-muted hover:bg-bg-subtle hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <Link
        href="/settings"
        className="ml-2 hidden items-center gap-2 rounded-full border border-line px-2.5 py-1 text-xs text-ink-muted hover:text-ink md:flex"
        title={user.email || ""}
      >
        <span className="inline-block h-5 w-5 rounded-full bg-gradient-to-br from-brand to-accent" />
        <span className="max-w-[140px] truncate">{user.name || user.email}</span>
      </Link>
      <form action="/api/auth/signout" method="post" className="hidden md:block">
        <input type="hidden" name="csrfToken" value="dev" />
        <button className="ml-1 rounded-lg px-2 py-1 text-xs text-ink-faint hover:text-ink">
          Sign out
        </button>
      </form>

      {/* Mobile hamburger */}
      <button
        type="button"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-muted hover:text-ink md:hidden"
        onClick={() => setMobileOpen((v) => !v)}
      >
        {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {/* Mobile menu drawer */}
      {mobileOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu overlay"
            className="fixed inset-0 top-14 z-30 bg-black/40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-x-0 top-14 z-40 border-b border-line bg-bg-subtle p-4 shadow-soft md:hidden">
            <div className="flex flex-col gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm",
                    isActive(item.href)
                      ? "bg-bg-elevated text-ink"
                      : "text-ink-muted hover:bg-bg-elevated hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <div className="my-2 border-t border-line" />
              <div className="flex items-center justify-between gap-3 px-3 py-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-block h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-brand to-accent" />
                  <span className="truncate text-sm text-ink-muted">
                    {user.name || user.email}
                  </span>
                </div>
                <form action="/api/auth/signout" method="post">
                  <input type="hidden" name="csrfToken" value="dev" />
                  <button className="rounded-lg border border-line px-2 py-1 text-xs text-ink-muted hover:text-ink">
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
