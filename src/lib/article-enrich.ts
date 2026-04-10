import type { Article, Source } from "@prisma/client";
import { db } from "@/lib/db";
import { ai } from "@/lib/ai";
import { extractKeywords, similarityScore } from "@/lib/similarity";
import { safeParseJson } from "@/lib/utils";
import type {
  ArticleSummary,
  ComparativeSynthesis,
  ContrarianView,
  SuggestedQuestions,
} from "@/lib/ai/types";

export type ArticleWithSource = Article & { source: Source };

/**
 * Ensure an article has a real AI summary, key points, entities and topic
 * tags cached on the row. Called lazily when the user opens the article
 * detail page. Idempotent — if the article was already enriched within
 * the last hour and has non-empty key points, this is a no-op.
 *
 * Uses the configured AI provider. Defaults to MockProvider if none set,
 * so this is always safe to call even with no API keys.
 */
export async function enrichArticleSummary(
  article: ArticleWithSource,
): Promise<ArticleWithSource> {
  const keyPoints = safeParseJson<string[]>(article.keyPointsJson, []);
  const alreadyRich = keyPoints.length > 0 && article.summaryLong.length > 120;

  // Re-enrich if the cache is empty/stale (> 7 days old).
  const STALE_MS = 7 * 24 * 60 * 60 * 1000;
  const isStale =
    !article.enrichedAt || Date.now() - article.enrichedAt.getTime() > STALE_MS;

  if (alreadyRich && !isStale) return article;

  try {
    const summary: ArticleSummary = await ai.summarizeArticle({
      headline: article.headline,
      text: article.articleText || article.previewText || article.headline,
    });
    const updated = await db.article.update({
      where: { id: article.id },
      data: {
        summaryShort: summary.short || article.summaryShort,
        summaryLong: summary.long || article.summaryLong,
        keyPointsJson: JSON.stringify(summary.keyPoints ?? keyPoints),
        entitiesJson: JSON.stringify(
          summary.entities ?? safeParseJson<string[]>(article.entitiesJson, []),
        ),
        topicTagsJson: JSON.stringify(
          summary.topicTags ?? safeParseJson<string[]>(article.topicTagsJson, []),
        ),
        enrichedAt: new Date(),
      },
    });
    return { ...updated, source: article.source };
  } catch (err) {
    console.warn("[enrich] summary failed:", (err as Error).message);
    return article;
  }
}

/**
 * Find articles from OTHER sources that are about the same story as the
 * given article. Uses `src/lib/similarity.ts` (token + named-entity
 * Jaccard) over a recent window of articles. Dedupes by source.
 *
 * Returns two groups:
 *   - related: mainstream / high-trust sources
 *   - contrarian: state-affiliated or explicitly contrarian sources
 *
 * Both groups are scored the same way — the split is only by source
 * trust tier / perspective tags. Contrarian articles appear in the
 * dedicated "Contrarian view" section on the article page.
 */
export async function findRelatedArticles(
  primary: ArticleWithSource,
  opts: { limit?: number; minScore?: number; windowDays?: number } = {},
): Promise<{
  related: Array<{ article: ArticleWithSource; score: number }>;
  contrarian: Array<{ article: ArticleWithSource; score: number }>;
}> {
  const limit = opts.limit ?? 6;
  const minScore = opts.minScore ?? 0.06;
  const windowDays = opts.windowDays ?? 30;

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const pool = await db.article.findMany({
    where: {
      id: { not: primary.id },
      sourceId: { not: primary.sourceId },
      publishedAt: { gte: since },
    },
    include: { source: true },
    orderBy: { publishedAt: "desc" },
    take: 400,
  });

  const primaryKws = extractKeywords(
    `${primary.headline} ${primary.summaryShort} ${primary.summaryLong}`,
  );

  const scored = pool
    .map((a) => {
      const kws = extractKeywords(`${a.headline} ${a.summaryShort} ${a.summaryLong}`);
      const score = similarityScore(primaryKws, kws);
      return { article: a, score };
    })
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score);

  // Dedupe by source — keep the highest-scoring article per source so each
  // row in the UI is a distinct editorial perspective.
  const bySource = new Map<string, { article: ArticleWithSource; score: number }>();
  for (const entry of scored) {
    if (!bySource.has(entry.article.sourceId)) {
      bySource.set(entry.article.sourceId, entry);
    }
  }

  const deduped = Array.from(bySource.values());

  const related: Array<{ article: ArticleWithSource; score: number }> = [];
  const contrarian: Array<{ article: ArticleWithSource; score: number }> = [];

  for (const entry of deduped) {
    const tags = safeParseJson<string[]>(entry.article.source.perspectiveTags, []);
    const isContrarian =
      entry.article.source.trustTier === "state-affiliated" ||
      tags.includes("contrarian");
    if (isContrarian) contrarian.push(entry);
    else related.push(entry);
    if (related.length >= limit && contrarian.length >= 4) break;
  }

  return {
    related: related.slice(0, limit),
    contrarian: contrarian.slice(0, 4),
  };
}

/**
 * Compute and cache comparative synthesis + contrarian view + suggested
 * questions for an article given its (dynamically-computed) related set.
 * Results are cached on the Article row so revisiting the page is cheap.
 */
export async function enrichArticleAnalysis(
  article: ArticleWithSource,
  relatedSet: {
    related: Array<{ article: ArticleWithSource }>;
    contrarian: Array<{ article: ArticleWithSource }>;
  },
): Promise<{
  synthesis: ComparativeSynthesis;
  contrarian: ContrarianView;
  suggestions: SuggestedQuestions;
  fromCache: boolean;
}> {
  const cachedSynthesis = article.synthesisJson
    ? safeParseJson<ComparativeSynthesis | null>(article.synthesisJson, null)
    : null;
  const cachedContrarian = article.contrarianJson
    ? safeParseJson<ContrarianView | null>(article.contrarianJson, null)
    : null;
  const cachedSuggestions = safeParseJson<string[]>(article.suggestedQuestionsJson, []);

  const CACHE_MS = 6 * 60 * 60 * 1000; // 6 hours
  const fresh =
    article.enrichedAt &&
    Date.now() - article.enrichedAt.getTime() < CACHE_MS &&
    cachedSynthesis &&
    cachedSuggestions.length > 0;

  if (fresh) {
    return {
      synthesis: cachedSynthesis!,
      contrarian: cachedContrarian || {
        summary: "",
        whyItDiffers: "",
        supportingUrls: [],
      },
      suggestions: { questions: cachedSuggestions },
      fromCache: true,
    };
  }

  const topic = article.headline;

  const [synthesis, contrarianView, suggestions] = await Promise.all([
    relatedSet.related.length > 0
      ? ai.comparativeSynthesis({
          topic,
          articles: [
            {
              source: article.source.name,
              headline: article.headline,
              summary: article.summaryShort || article.summaryLong,
            },
            ...relatedSet.related.map((r) => ({
              source: r.article.source.name,
              headline: r.article.headline,
              summary: r.article.summaryShort || r.article.summaryLong,
            })),
          ],
        })
      : Promise.resolve<ComparativeSynthesis>({
          commonFacts: [],
          disagreements: [],
          framingDifferences: [],
          missingContext: [],
        }),
    relatedSet.contrarian.length > 0
      ? ai.contrarianView({
          topic,
          mainstreamSummary: article.summaryShort || article.summaryLong,
          contrarianArticles: relatedSet.contrarian.map((r) => ({
            source: r.article.source.name,
            headline: r.article.headline,
            url: r.article.url,
            summary: r.article.summaryShort || r.article.summaryLong,
          })),
        })
      : Promise.resolve<ContrarianView>({
          summary: "",
          whyItDiffers: "",
          supportingUrls: [],
        }),
    ai.suggestedQuestions({
      topic,
      headline: article.headline,
      summary: article.summaryShort || article.summaryLong,
    }),
  ]);

  // Cache — fire-and-forget; we don't want DB slowness to delay render.
  void db.article
    .update({
      where: { id: article.id },
      data: {
        synthesisJson: JSON.stringify(synthesis),
        contrarianJson: JSON.stringify(contrarianView),
        suggestedQuestionsJson: JSON.stringify(suggestions.questions ?? []),
        enrichedAt: new Date(),
      },
    })
    .catch((err) => console.warn("[enrich] cache write failed:", err.message));

  return { synthesis, contrarian: contrarianView, suggestions, fromCache: false };
}
