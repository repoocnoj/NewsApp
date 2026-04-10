import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { safeParseJson } from "@/lib/utils";
import { SettingsForm } from "./form";

const TOPIC_CATALOG = [
  "geopolitics",
  "middle-east",
  "energy",
  "markets",
  "technology",
  "ai-regulation",
  "climate",
  "politics",
  "science",
  "health",
  "conflict",
];

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const sources = await db.source.findMany({ orderBy: { name: "asc" } });
  const pref = user.preference;
  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-6">
        <div className="label">Settings</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Preferences</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Tune which topics and sources NewsApp uses to personalize your feed.
        </p>
      </div>
      <SettingsForm
        topics={TOPIC_CATALOG}
        sources={sources.map((s) => ({
          id: s.id,
          name: s.name,
          region: s.region ?? "",
          trustTier: s.trustTier,
          perspectiveTags: safeParseJson<string[]>(s.perspectiveTags, []),
        }))}
        initial={{
          topics: pref ? safeParseJson<string[]>(pref.followedTopics, []) : [],
          preferredSources: pref ? safeParseJson<string[]>(pref.preferredSourceIds, []) : [],
          excludedSources: pref ? safeParseJson<string[]>(pref.excludedSourceIds, []) : [],
        }}
      />
    </div>
  );
}
