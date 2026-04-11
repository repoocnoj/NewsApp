import Parser from "rss-parser";
import type { RawArticle, SourceAdapter } from "./types";

/**
 * rss-parser custom-fields schema. Most publishers ship images in one of:
 *   - <media:content url="..." /> (Media RSS)
 *   - <media:thumbnail url="..." />
 *   - <enclosure url="..." type="image/..." />
 *   - an <img> tag inside <content:encoded> or <description>
 * We extract in that order and stop at the first hit.
 */
interface ExtendedItem {
  link?: string;
  title?: string;
  isoDate?: string;
  pubDate?: string;
  creator?: string;
  author?: string;
  "content:encoded"?: string;
  content?: string;
  contentSnippet?: string;
  description?: string;
  enclosure?: { url?: string; type?: string };
  mediaContent?: Array<{ $?: { url?: string; type?: string; medium?: string } }>;
  mediaThumbnail?: Array<{ $?: { url?: string } }>;
  itunesImage?: { $?: { href?: string } };
}

const parser: Parser<unknown, ExtendedItem> = new Parser({
  timeout: 10_000,
  headers: { "User-Agent": "NewsApp/0.1 (+https://localhost)" },
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
      ["itunes:image", "itunesImage"],
    ],
  },
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
      for (const item of feed.items as ExtendedItem[]) {
        if (!item.link || !item.title) continue;
        const published = item.isoDate
          ? new Date(item.isoDate)
          : item.pubDate
            ? new Date(item.pubDate)
            : new Date();
        const contentHtml = item["content:encoded"] || item.content || item.description || "";
        const text = stripHtml(contentHtml || item.contentSnippet || "").trim();
        const imageUrl = extractImage(item, contentHtml);
        out.push({
          url: item.link,
          headline: item.title.trim(),
          author: item.creator || item.author || undefined,
          publishedAt: published,
          articleText: text,
          previewText: text.slice(0, 400),
          imageUrl,
        });
      }
      return out;
    },
  };
}

function extractImage(item: ExtendedItem, contentHtml: string): string | undefined {
  // 1. Media RSS: <media:content url="..." />
  if (Array.isArray(item.mediaContent)) {
    for (const mc of item.mediaContent) {
      const url = mc?.$?.url;
      const type = mc?.$?.type || "";
      const medium = mc?.$?.medium || "";
      if (url && (medium === "image" || type.startsWith("image") || !type)) {
        if (isLikelyImageUrl(url)) return url;
      }
    }
  }
  // 2. Media RSS: <media:thumbnail url="..." />
  if (Array.isArray(item.mediaThumbnail)) {
    for (const mt of item.mediaThumbnail) {
      const url = mt?.$?.url;
      if (url && isLikelyImageUrl(url)) return url;
    }
  }
  // 3. Classic RSS: <enclosure url="..." type="image/..." />
  if (item.enclosure?.url) {
    const type = item.enclosure.type || "";
    if (type.startsWith("image") || isLikelyImageUrl(item.enclosure.url)) {
      return item.enclosure.url;
    }
  }
  // 4. iTunes: <itunes:image href="..." />
  if (item.itunesImage?.$?.href) return item.itunesImage.$.href;
  // 5. First <img> in the HTML body
  if (contentHtml) {
    const m = contentHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m && isLikelyImageUrl(m[1])) return m[1];
  }
  return undefined;
}

function isLikelyImageUrl(url: string): boolean {
  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  // Strip query string for extension matching
  const path = url.split("?")[0];
  if (/\.(jpe?g|png|webp|gif|avif)$/i.test(path)) return true;
  // Some CDNs don't have extensions (e.g. BBC's ichef)
  if (/\/(image|img|media|thumb|photo)/i.test(path)) return true;
  return false;
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
