import { db } from "@/lib/db";
import { ai } from "@/lib/ai";
import { rssAdapter } from "./rss";
import type { RawArticle } from "./types";

/**
 * Process a raw article into the database: creates the Article row if new,
 * enriches it with AI summary/topic tags/entities, and caches the result.
 *
 * Idempotent on URL.
 */
export async function upsertRawArticle(
  sourceId: string,
  raw: RawArticle,
  clusterId?: string,
) {
  const existing = await db.article.findUnique({ where: { url: raw.url } });
  if (existing) return existing;

  const summary = await ai.summarizeArticle({
    headline: raw.headline,
    text: raw.articleText || raw.headline,
  });

  return db.article.create({
    data: {
      sourceId,
      url: raw.url,
      headline: raw.headline,
      author: raw.author,
      publishedAt: raw.publishedAt,
      topicClusterId: clusterId,
      articleText: raw.articleText ?? "",
      previewText: raw.previewText ?? raw.articleText?.slice(0, 400) ?? "",
      imageUrl: raw.imageUrl,
      summaryShort: summary.short,
      summaryLong: summary.long,
      keyPointsJson: JSON.stringify(summary.keyPoints ?? []),
      entitiesJson: JSON.stringify(summary.entities ?? []),
      topicTagsJson: JSON.stringify(summary.topicTags ?? []),
    },
  });
}

/**
 * Run ingestion for all active RSS sources. Called from `scripts/ingest.ts`
 * or programmatically from an admin action. Skips live fetch when
 * INGEST_LIVE is not set to "1".
 */
export async function runLiveIngestion() {
  if (process.env.INGEST_LIVE !== "1") {
    return { fetched: 0, note: "INGEST_LIVE not set; skipping live fetch." };
  }
  const sources = await db.source.findMany({
    where: { isActive: true, ingestStrategy: "rss" },
  });
  let count = 0;
  for (const src of sources) {
    if (!src.rssUrl) continue;
    try {
      const adapter = rssAdapter(src.slug, src.rssUrl);
      const items = await adapter.fetch();
      for (const raw of items.slice(0, 10)) {
        try {
          await upsertRawArticle(src.id, raw);
          count++;
        } catch (err) {
          console.warn(`[ingest] failed item ${raw.url}:`, (err as Error).message);
        }
      }
    } catch (err) {
      console.warn(`[ingest] failed feed ${src.slug}:`, (err as Error).message);
    }
  }
  return { fetched: count, note: "" };
}
