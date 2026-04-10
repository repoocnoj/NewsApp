import Parser from "rss-parser";
import type { RawArticle, SourceAdapter } from "./types";

const parser = new Parser({
  timeout: 10_000,
  headers: { "User-Agent": "NewsApp/0.1 (+https://localhost)" },
});

/**
 * Generic RSS adapter. Safe to run against any standard feed. The adapter
 * only extracts what the feed actually ships — it does not attempt to
 * crawl the full article body (which typically requires per-site
 * scraping logic or paid APIs).
 */
export function rssAdapter(slug: string, feedUrl: string): SourceAdapter {
  return {
    slug,
    async fetch(): Promise<RawArticle[]> {
      const feed = await parser.parseURL(feedUrl);
      const out: RawArticle[] = [];
      for (const item of feed.items) {
        if (!item.link || !item.title) continue;
        const published = item.isoDate
          ? new Date(item.isoDate)
          : item.pubDate
            ? new Date(item.pubDate)
            : new Date();
        const contentHtml = (item["content:encoded"] as string) || item.content || item.contentSnippet || "";
        const text = stripHtml(contentHtml).trim();
        out.push({
          url: item.link,
          headline: item.title.trim(),
          author: (item.creator as string) || (item.author as string) || undefined,
          publishedAt: published,
          articleText: text,
          previewText: text.slice(0, 400),
        });
      }
      return out;
    },
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ");
}
