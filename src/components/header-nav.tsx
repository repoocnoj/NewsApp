"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/feed", label: "Feed" },
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
  return (
    <nav className="flex items-center gap-1">
      {user ? (
        <>
          <div className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-bg-elevated text-ink"
                      : "text-ink-muted hover:bg-bg-subtle hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <Link
            href="/settings"
            className="ml-2 hidden items-center gap-2 rounded-full border border-line px-2.5 py-1 text-xs text-ink-muted hover:text-ink md:flex"
            title={user.email || ""}
          >
            <span className="inline-block h-5 w-5 rounded-full bg-gradient-to-br from-brand to-accent" />
            <span>{user.name || user.email}</span>
          </Link>
          <form action="/api/auth/signout" method="post">
            <input type="hidden" name="csrfToken" value="dev" />
            <button className="ml-1 rounded-lg px-2 py-1 text-xs text-ink-faint hover:text-ink">
              Sign out
            </button>
          </form>
        </>
      ) : (
        <>
          <Link href="/signin" className="btn-ghost">
            Sign in
          </Link>
        </>
      )}
    </nav>
  );
}
