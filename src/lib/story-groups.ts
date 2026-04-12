import { extractKeywords, similarityScore } from "@/lib/similarity";
import { safeParseJson } from "@/lib/utils";

type FeedArticle = {
  id: string;
  headline: string;
  summaryShort: string;
  imageUrl: string | null;
  topicTagsJson: string;
  publishedAt: Date;
  source: { name: string; trustTier: string };
  [key: string]: unknown;
};

export type StoryGroup = {
  /** The "primary" article — highest-scoring article in the group */
  primary: FeedArticle;
  /** Synthesized event label (derived from the best headline) */
  eventLabel: string;
  /** Other articles covering the same story */
  otherSources: Array<{
    id: string;
    sourceName: string;
    headline: string;
  }>;
  /** Resolved image: primary's image, or a neighbour's image, or null */
  imageUrl: string | null;
  /** Number of distinct sources covering this story */
  sourceCount: number;
};

const SIMILARITY_THRESHOLD = 0.12;

/**
 * Groups a flat list of ranked articles into story clusters.
 *
 * Two articles are considered the same "story" if their headline + summary
 * similarity (token + entity Jaccard) exceeds SIMILARITY_THRESHOLD and
 * they come from different sources. Within each group, the highest-ranked
 * article becomes the "primary" card the user sees in the feed; the others
 * collapse into a "Also reported by: BBC, NPR, Al Jazeera" line.
 *
 * Image fallback: if the primary article has no image, we check every
 * other article in the same group. If none has an image either, imageUrl
 * stays null and the card shows the category-gradient placeholder.
 */
export function groupByStory(articles: FeedArticle[]): StoryGroup[] {
  if (articles.length === 0) return [];

  // Pre-compute keyword bags for every article
  const bags = articles.map((a) =>
    extractKeywords(`${a.headline} ${a.summaryShort}`),
  );

  // Track which articles have been claimed by a group
  const claimed = new Set<number>();
  const groups: StoryGroup[] = [];

  for (let i = 0; i < articles.length; i++) {
    if (claimed.has(i)) continue;
    claimed.add(i);

    const primary = articles[i];
    const neighbours: Array<{ idx: number; article: FeedArticle }> = [];

    for (let j = i + 1; j < articles.length; j++) {
      if (claimed.has(j)) continue;
      // Skip same-source duplicates outright
      if (articles[j].source.name === primary.source.name) {
        // Same source, different article — might be a different story.
        // Only group if very high similarity (likely a duplicate/update).
        const sim = similarityScore(bags[i], bags[j]);
        if (sim > 0.35) {
          claimed.add(j);
          neighbours.push({ idx: j, article: articles[j] });
        }
        continue;
      }
      const sim = similarityScore(bags[i], bags[j]);
      if (sim >= SIMILARITY_THRESHOLD) {
        claimed.add(j);
        neighbours.push({ idx: j, article: articles[j] });
      }
    }

    // Resolve image: primary first, then neighbours
    let imageUrl = primary.imageUrl;
    if (!imageUrl) {
      for (const n of neighbours) {
        if (n.article.imageUrl) {
          imageUrl = n.article.imageUrl;
          break;
        }
      }
    }

    groups.push({
      primary,
      eventLabel: primary.headline,
      otherSources: neighbours.map((n) => ({
        id: n.article.id,
        sourceName: n.article.source.name,
        headline: n.article.headline,
      })),
      imageUrl,
      sourceCount: 1 + new Set(neighbours.map((n) => n.article.source.name)).size,
    });
  }

  return groups;
}
