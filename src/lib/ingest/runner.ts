import { db } from "@/lib/db";
import { ai } from "@/lib/ai";
import { rssAdapter } from "./rss";
import type { RawArticle } from "./types";

/**
 * Process a raw article into the database: creates the Article row if new,
 * optionally enriches it with AI summary/topic tags/entities.
 *
 * Idempotent on URL. Returns the article + whether it was newly created.
 */
export async function upsertRawArticle(
  sourceId: string,
  raw: RawArticle,
  clusterId?: string,
  opts: { enrichWithAI?: boolean } = {},
): Promise<{ article: any; isNew: boolean }> {
  const existing = await db.article.findUnique({ where: { url: raw.url } });
  if (existing) return { article: existing, isNew: false };

  let summaryShort = (raw.previewText ?? raw.articleText ?? raw.headline).slice(0, 220).trim();
  let summaryLong = (raw.articleText ?? raw.headline).slice(0, 900).trim();
  let keyPoints: string[] = [];
  let entities: string[] = [];
  let topicTags: string[] = [];

  if (opts.enrichWithAI) {
    const summary = await ai.summarizeArticle({
      headline: raw.headline,
      text: raw.articleText || raw.headline,
    });
    summaryShort = summary.short || summaryShort;
    summaryLong = summary.long || summaryLong;
    keyPoints = summary.keyPoints ?? [];
    entities = summary.entities ?? [];
    topicTags = summary.topicTags ?? [];
  }

  const article = await db.article.create({
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
      summaryShort,
      summaryLong,
      keyPointsJson: JSON.stringify(keyPoints),
      entitiesJson: JSON.stringify(entities),
      topicTagsJson: JSON.stringify(topicTags),
    },
  });
  return { article, isNew: true };
}

/**
 * Run ingestion for all active RSS sources. Called from `scripts/ingest.ts`
 * or programmatically from an admin action. Skips live fetch when
 * INGEST_LIVE is not set to "1" unless `force: true` is passed (which the
 * admin API route uses — an authenticated call there is an explicit opt-in).
 */
export async function runLiveIngestion(
  opts: { force?: boolean; limit?: number; enrichWithAI?: boolean } = {},
) {
  if (!opts.force && process.env.INGEST_LIVE !== "1") {
    return { fetched: 0, failed: 0, skippedSources: 0, note: "INGEST_LIVE not set; skipping live fetch." };
  }
  const limit = opts.limit ?? 10;
  const enrichWithAI = opts.enrichWithAI ?? false;
  const sources = await db.source.findMany({
    where: { isActive: true, ingestStrategy: "rss" },
  });
  let newArticles = 0;
  let existingArticles = 0;
  let failed = 0;
  let skippedSources = 0;
  const errors: Array<{ source: string; error: string }> = [];

  for (const src of sources) {
    if (!src.rssUrl) {
      skippedSources++;
      continue;
    }
    try {
      const adapter = rssAdapter(src.slug, src.rssUrl);
      const items = await adapter.fetch();
      for (const raw of items.slice(0, limit)) {
        try {
          const result = await upsertRawArticle(src.id, raw, undefined, { enrichWithAI });
          if (result.isNew) newArticles++;
          else existingArticles++;
        } catch (err) {
          failed++;
          errors.push({ source: src.slug, error: (err as Error).message });
        }
      }
    } catch (err) {
      failed++;
      errors.push({ source: src.slug, error: (err as Error).message });
    }
  }
  return {
    fetched: newArticles,
    existing: existingArticles,
    failed,
    skippedSources,
    errors,
    note: newArticles === 0 && existingArticles > 0
      ? "No new articles — all RSS items are already in your feed. Sources update every few hours."
      : "",
  };
}
