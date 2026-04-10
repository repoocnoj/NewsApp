import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { OnboardingForm } from "./form";

const TOPIC_CATALOG = [
  { id: "geopolitics", label: "Geopolitics" },
  { id: "middle-east", label: "Middle East" },
  { id: "energy", label: "Energy & Oil" },
  { id: "markets", label: "Markets" },
  { id: "technology", label: "Technology" },
  { id: "ai-regulation", label: "AI & Regulation" },
  { id: "climate", label: "Climate" },
  { id: "politics", label: "Politics" },
  { id: "science", label: "Science" },
  { id: "health", label: "Health" },
];

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const sources = await db.source.findMany({ orderBy: { name: "asc" } });
  const sampleArticles = await db.article.findMany({
    take: 6,
    orderBy: { publishedAt: "desc" },
    include: { source: true },
  });

  const pref = user.preference;
  const selectedTopics = pref ? (JSON.parse(pref.followedTopics) as string[]) : [];
  const selectedSources = pref ? (JSON.parse(pref.preferredSourceIds) as string[]) : [];
  const excludedSources = pref ? (JSON.parse(pref.excludedSourceIds) as string[]) : [];

  return (
    <div className="container max-w-3xl py-10">
      <div className="mb-6">
        <div className="label">Welcome</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Personalize your NewsApp</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Tell us a bit about what you&rsquo;re interested in. You can change everything later in
          Settings.
        </p>
      </div>
      <OnboardingForm
        topics={TOPIC_CATALOG}
        sources={sources.map((s) => ({
          id: s.id,
          name: s.name,
          region: s.region ?? "",
          trustTier: s.trustTier,
          perspectiveTags: JSON.parse(s.perspectiveTags) as string[],
        }))}
        sampleArticles={sampleArticles.map((a) => ({
          id: a.id,
          headline: a.headline,
          source: a.source.name,
          summaryShort: a.summaryShort,
          topicTags: JSON.parse(a.topicTagsJson) as string[],
        }))}
        initial={{
          topics: selectedTopics,
          preferredSources: selectedSources,
          excludedSources,
        }}
      />
    </div>
  );
}
