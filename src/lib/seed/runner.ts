import type { PrismaClient } from "@prisma/client";
import {
  SOURCES,
  CLUSTERS,
  ARTICLES,
  TIMELINE_EVENTS,
} from "../ingest/seed-data";

/**
 * Shared, idempotent seeding logic. Can be called from:
 *   - the CLI script (`prisma/seed.ts`, via `npm run db:seed`)
 *   - the protected API route (`/api/admin/seed`) for prod bootstrap
 *
 * Safe to re-run: every insert either upserts or checks existence first.
 *
 * `skipDemoArticles` (default false): when true, the 15 hand-written
 * example articles are skipped. Sources, topic clusters, timeline events,
 * and article relationships are still created/maintained. The API route
 * sets this to true so a prod seed doesn't pollute the feed with fake
 * articles — prod should populate from live RSS ingestion instead.
 *
 * `enrichWithAI=false` uses trivial fallback summaries (first 200 chars
 * of the article text) so seeding stays fast even with a real AI
 * provider configured.
 */
export async function runSeed(
  db: PrismaClient,
  opts: { enrichWithAI?: boolean; skipDemoArticles?: boolean } = {},
): Promise<{
  sources: number;
  clusters: number;
  articles: number;
  articlesAdded: number;
  relationships: number;
  timelineEvents: number;
}> {
  const { enrichWithAI = false, skipDemoArticles = false } = opts;

  let srcCount = 0;
  for (const s of SOURCES) {
    await db.source.upsert({
      where: { slug: s.slug },
      create: {
        slug: s.slug,
        name: s.name,
        homepageUrl: s.homepageUrl,
        rssUrl: s.rssUrl,
        region: s.region,
        trustTier: s.trustTier,
        perspectiveTags: JSON.stringify(s.perspectiveTags),
        ingestStrategy: s.ingestStrategy,
      },
      update: {
        name: s.name,
        homepageUrl: s.homepageUrl,
        rssUrl: s.rssUrl,
        region: s.region,
        trustTier: s.trustTier,
        perspectiveTags: JSON.stringify(s.perspectiveTags),
        ingestStrategy: s.ingestStrategy,
      },
    });
    srcCount++;
  }

  let clusterCount = 0;
  for (const c of CLUSTERS) {
    await db.topicCluster.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        label: c.label,
        summary: c.summary,
        canonicalQuestion: c.canonicalQuestion,
      },
      update: {
        label: c.label,
        summary: c.summary,
        canonicalQuestion: c.canonicalQuestion,
      },
    });
    clusterCount++;
  }

  let articleCount = 0;
  let articlesAdded = 0;
  if (!skipDemoArticles) {
    for (const a of ARTICLES) {
      const source = await db.source.findUnique({ where: { slug: a.sourceSlug } });
      const cluster = await db.topicCluster.findUnique({ where: { slug: a.clusterSlug } });
      if (!source || !cluster) continue;

      const existing = await db.article.findUnique({ where: { url: a.url } });
      if (existing) {
        articleCount++;
        continue;
      }

      let summaryShort = a.articleText.slice(0, 220).trim();
      let summaryLong = a.articleText.slice(0, 900).trim();
      let keyPoints: string[] = [];
      let entities: string[] = [];
      let topicTags: string[] = inferTopicTags(a.headline + " " + a.articleText);

      if (enrichWithAI) {
        // Dynamic import keeps the AI module out of the edge/serverless
        // cold-start path when we're using the fallback seed.
        const { ai } = await import("../ai");
        const summary = await ai.summarizeArticle({
          headline: a.headline,
          text: a.articleText,
        });
        summaryShort = summary.short || summaryShort;
        summaryLong = summary.long || summaryLong;
        keyPoints = summary.keyPoints || [];
        entities = summary.entities || [];
        topicTags = summary.topicTags || topicTags;
      }

      await db.article.create({
        data: {
          sourceId: source.id,
          topicClusterId: cluster.id,
          url: a.url,
          headline: a.headline,
          author: a.author,
          publishedAt: new Date(a.publishedAt),
          articleText: a.articleText,
          previewText: a.articleText.slice(0, 400),
          imageUrl: a.imageUrl,
          summaryShort,
          summaryLong,
          keyPointsJson: JSON.stringify(keyPoints),
          entitiesJson: JSON.stringify(entities),
          topicTagsJson: JSON.stringify(topicTags),
        },
      });
      articleCount++;
      articlesAdded++;
    }
  }

  // Relationships between articles in the same cluster
  let relCount = 0;
  const clusters = await db.topicCluster.findMany({
    include: { articles: { include: { source: true } } },
  });
  for (const cluster of clusters) {
    for (const a of cluster.articles) {
      for (const b of cluster.articles) {
        if (a.id === b.id) continue;
        const bTags = safeParse(b.source.perspectiveTags);
        const aTags = safeParse(a.source.perspectiveTags);
        const isBContrarian =
          b.source.trustTier === "state-affiliated" || bTags.includes("contrarian");
        const isAContrarian =
          a.source.trustTier === "state-affiliated" || aTags.includes("contrarian");
        const relationshipType =
          isBContrarian && !isAContrarian ? "contrarian" : "related";
        try {
          await db.articleRelationship.create({
            data: {
              fromArticleId: a.id,
              toArticleId: b.id,
              relationshipType,
              score: 0.9,
            },
          });
          relCount++;
        } catch {
          // Unique constraint: already exists.
        }
      }
    }
  }

  let eventCount = 0;
  for (const e of TIMELINE_EVENTS) {
    const cluster = await db.topicCluster.findUnique({ where: { slug: e.clusterSlug } });
    if (!cluster) continue;
    const exists = await db.topicTimelineEvent.findFirst({
      where: { topicClusterId: cluster.id, title: e.title },
    });
    if (exists) {
      eventCount++;
      continue;
    }
    await db.topicTimelineEvent.create({
      data: {
        topicClusterId: cluster.id,
        eventDate: new Date(e.eventDate),
        title: e.title,
        description: e.description,
        sourceRefsJson: JSON.stringify(e.sourceRefs ?? []),
      },
    });
    eventCount++;
  }

  return {
    sources: srcCount,
    clusters: clusterCount,
    articles: articleCount,
    articlesAdded,
    relationships: relCount,
    timelineEvents: eventCount,
  };
}

function safeParse(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function inferTopicTags(text: string): string[] {
  const lc = text.toLowerCase();
  const topics: Array<[string, string[]]> = [
    ["geopolitics", ["treaty", "diplomat", "sanction", "nato", "foreign", "embassy"]],
    ["conflict", ["war", "strike", "missile", "troops", "helicopter", "drone"]],
    ["middle-east", ["iran", "israel", "gaza", "hormuz", "tehran", "saudi", "yemen"]],
    ["energy", ["oil", "opec", "gas", "energy", "crude", "barrel"]],
    ["markets", ["market", "stock", "bond", "inflation", "fed"]],
    ["technology", ["ai", "chip", "tech", "software", "cloud"]],
    ["ai-regulation", ["ai act", "frontier", "audit", "regulation"]],
    ["politics", ["election", "president", "parliament", "congress"]],
  ];
  const out: string[] = [];
  for (const [tag, kws] of topics) {
    if (kws.some((k) => lc.includes(k))) out.push(tag);
  }
  return out.slice(0, 5);
}
