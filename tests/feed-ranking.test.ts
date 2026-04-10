import { describe, it, expect } from "vitest";

/**
 * Standalone copy of the scoring math from src/lib/feed.ts so we can unit-test
 * ranking behavior without a database. Keeps the test fast and focused.
 */
function score({
  ageHours,
  topicMatches,
  preferred,
  trust,
  liked,
  disliked,
}: {
  ageHours: number;
  topicMatches: number;
  preferred: boolean;
  trust: "high" | "mixed" | "state-affiliated" | "opinion";
  liked: boolean;
  disliked: boolean;
}) {
  const recency = 48 / (ageHours + 24);
  const topicMatch = topicMatches;
  const sourcePreferred = preferred ? 1 : 0;
  const trustBump = trust === "high" ? 0.5 : 0;
  const likeBump = liked ? 0.75 : 0;
  const dislikePen = disliked ? 1.5 : 0;
  return (
    recency * 1.0 +
    topicMatch * 2.0 +
    sourcePreferred * 2.5 +
    trustBump -
    dislikePen +
    likeBump
  );
}

describe("feed ranking", () => {
  it("topic match dominates age", () => {
    const fresh = score({ ageHours: 1, topicMatches: 0, preferred: false, trust: "mixed", liked: false, disliked: false });
    const topical = score({ ageHours: 72, topicMatches: 2, preferred: false, trust: "mixed", liked: false, disliked: false });
    expect(topical).toBeGreaterThan(fresh);
  });

  it("preferred source outranks untrusted topical", () => {
    const preferred = score({ ageHours: 24, topicMatches: 1, preferred: true, trust: "high", liked: false, disliked: false });
    const neutral = score({ ageHours: 24, topicMatches: 1, preferred: false, trust: "mixed", liked: false, disliked: false });
    expect(preferred).toBeGreaterThan(neutral);
  });

  it("disliked articles are penalized", () => {
    const neutral = score({ ageHours: 24, topicMatches: 1, preferred: false, trust: "high", liked: false, disliked: false });
    const disliked = score({ ageHours: 24, topicMatches: 1, preferred: false, trust: "high", liked: false, disliked: true });
    expect(neutral).toBeGreaterThan(disliked);
  });
});
