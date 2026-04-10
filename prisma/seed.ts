import { PrismaClient } from "@prisma/client";
import { ai } from "../src/lib/ai";
import {
  SOURCES,
  CLUSTERS,
  ARTICLES,
  TIMELINE_EVENTS,
} from "../src/lib/ingest/seed-data";

const db = new PrismaClient();

async function main() {
  console.log("[seed] upserting sources…");
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
  }

  console.log("[seed] upserting topic clusters…");
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
  }

  console.log("[seed] upserting articles + AI summaries (mock provider unless AI_PROVIDER set)…");
  for (const a of ARTICLES) {
    const source = await db.source.findUnique({ where: { slug: a.sourceSlug } });
    const cluster = await db.topicCluster.findUnique({ where: { slug: a.clusterSlug } });
    if (!source || !cluster) continue;

    const existing = await db.article.findUnique({ where: { url: a.url } });
    if (existing) continue;

    const summary = await ai.summarizeArticle({
      headline: a.headline,
      text: a.articleText,
    });

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
        summaryShort: summary.short,
        summaryLong: summary.long,
        keyPointsJson: JSON.stringify(summary.keyPoints ?? []),
        entitiesJson: JSON.stringify(summary.entities ?? []),
        topicTagsJson: JSON.stringify(summary.topicTags ?? []),
      },
    });
  }

  console.log("[seed] computing article relationships…");
  const clusters = await db.topicCluster.findMany({ include: { articles: true } });
  for (const cluster of clusters) {
    const articles = cluster.articles;
    for (const a of articles) {
      for (const b of articles) {
        if (a.id === b.id) continue;
        const bSource = await db.source.findUnique({ where: { id: b.sourceId } });
        const aSource = await db.source.findUnique({ where: { id: a.sourceId } });
        const isContrarian =
          (bSource &&
            (bSource.trustTier === "state-affiliated" ||
              JSON.parse(bSource.perspectiveTags).includes("contrarian"))) ||
          false;
        const isAContrarian =
          (aSource &&
            (aSource.trustTier === "state-affiliated" ||
              JSON.parse(aSource.perspectiveTags).includes("contrarian"))) ||
          false;
        // Only emit contrarian relationship from mainstream → contrarian
        // so the detail page shows contrarian alternatives when viewing a
        // mainstream article.
        const relationshipType =
          isContrarian && !isAContrarian ? "contrarian" : "related";
        try {
          await db.articleRelationship.create({
            data: {
              fromArticleId: a.id,
              toArticleId: b.id,
              relationshipType,
              score: 0.9,
            },
          });
        } catch {
          // Unique constraint: already exists.
        }
      }
    }
  }

  console.log("[seed] upserting timeline events…");
  for (const e of TIMELINE_EVENTS) {
    const cluster = await db.topicCluster.findUnique({ where: { slug: e.clusterSlug } });
    if (!cluster) continue;
    const exists = await db.topicTimelineEvent.findFirst({
      where: { topicClusterId: cluster.id, title: e.title },
    });
    if (exists) continue;
    await db.topicTimelineEvent.create({
      data: {
        topicClusterId: cluster.id,
        eventDate: new Date(e.eventDate),
        title: e.title,
        description: e.description,
        sourceRefsJson: JSON.stringify(e.sourceRefs ?? []),
      },
    });
  }

  console.log("[seed] ensuring demo user…");
  const demoEmail = "demo@newsapp.local";
  const demo = await db.user.upsert({
    where: { email: demoEmail },
    create: { email: demoEmail, name: "Demo Reader" },
    update: {},
  });
  await db.userPreference.upsert({
    where: { userId: demo.id },
    create: {
      userId: demo.id,
      followedTopics: JSON.stringify(["geopolitics", "energy", "middle-east"]),
      preferredSourceIds: JSON.stringify([]),
      excludedSourceIds: JSON.stringify([]),
      onboardingCompleted: true,
    },
    update: {},
  });

  console.log("[seed] done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
