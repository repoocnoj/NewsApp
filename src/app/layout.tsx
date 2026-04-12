import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { HeaderNav } from "@/components/header-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "NewsApp — truth-seeking news, personalized",
  description:
    "A calm, evidence-driven news reader that surfaces trusted sources, compares viewpoints, and helps you reach ground truth on the topics you care about.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-bg text-ink">
        {/* Inline script runs before React to prevent flash-of-wrong-theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('newsapp-theme');if(t==='light'){document.documentElement.classList.remove('dark');document.documentElement.classList.add('light')}}catch(e){}})()`,
          }}
        />
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
            <div className="container flex h-14 items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-gradient-to-br from-brand to-accent" />
                <span className="font-semibold tracking-tight">NewsApp</span>
                <span className="hidden text-xs text-ink-faint sm:inline">
                  · truth-seeking news
                </span>
              </Link>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <HeaderNav user={user ? { name: user.name, email: user.email } : null} />
              </div>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-line py-6 text-center text-xs text-ink-faint">
            NewsApp · evidence-driven · links and summaries are for informational purposes
          </footer>
        </div>
      </body>
    </html>
  );
}
