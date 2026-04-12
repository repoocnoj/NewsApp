"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "dark" | "light";

/**
 * Light/dark mode toggle. Persists the preference in localStorage
 * and applies the `dark` class on <html> to drive Tailwind's dark
 * mode selectors. Defaults to dark (the app's original design) and
 * falls back to system preference on first visit.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("newsapp-theme") as Theme | null;
    if (stored === "light" || stored === "dark") {
      applyTheme(stored);
      setTheme(stored);
    } else {
      // Respect system preference on first visit
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      const initial: Theme = prefersDark ? "dark" : "light";
      applyTheme(initial);
      setTheme(initial);
    }
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    localStorage.setItem("newsapp-theme", next);
  }

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) return <div className="h-8 w-8" />;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-muted transition-colors hover:text-ink",
      )}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}

function applyTheme(theme: Theme) {
  const html = document.documentElement;
  if (theme === "dark") {
    html.classList.add("dark");
    html.classList.remove("light");
  } else {
    html.classList.add("light");
    html.classList.remove("dark");
  }
}
