import { PrismaClient } from "@prisma/client";
import { runSeed } from "../src/lib/seed/runner";

const db = new PrismaClient();

async function main() {
  // CLI seed uses AI enrichment by default (MockProvider is instant, and a
  // real provider will only be called if AI_PROVIDER is set).
  const result = await runSeed(db, { enrichWithAI: true });
  console.log("[seed] done", result);

  // Ensure demo user exists for local convenience.
  const demo = await db.user.upsert({
    where: { email: "demo@newsapp.local" },
    create: { email: "demo@newsapp.local", name: "Demo Reader" },
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
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
