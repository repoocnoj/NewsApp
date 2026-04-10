import { describe, it, expect } from "vitest";
import { MockProvider } from "../src/lib/ai/providers/mock";

const provider = new MockProvider();

describe("MockProvider", () => {
  it("summarize_article returns valid JSON shape", async () => {
    const raw = await provider.generate({
      system: "task:summarize_article",
      messages: [
        {
          role: "user",
          content: `HEADLINE: US helicopter reported in incident near Strait of Hormuz\nTEXT: A US military helicopter was involved in a reported incident near the Strait of Hormuz. Iran denied any provocation. Oil prices edged higher.`,
        },
      ],
      jsonSchemaHint: "json",
    });
    const parsed = JSON.parse(raw);
    expect(parsed).toHaveProperty("short");
    expect(parsed).toHaveProperty("long");
    expect(Array.isArray(parsed.keyPoints)).toBe(true);
    expect(Array.isArray(parsed.entities)).toBe(true);
    expect(Array.isArray(parsed.topicTags)).toBe(true);
    expect(parsed.topicTags).toContain("middle-east");
  });

  it("suggested_questions returns array", async () => {
    const raw = await provider.generate({
      system: "task:suggested_questions",
      messages: [{ role: "user", content: "TOPIC: Iran Hormuz\nHEADLINE: test\nSUMMARY: oil and conflict" }],
      jsonSchemaHint: "json",
    });
    const parsed = JSON.parse(raw);
    expect(Array.isArray(parsed.questions)).toBe(true);
    expect(parsed.questions.length).toBeGreaterThan(0);
  });

  it("comparative_synthesis returns required keys", async () => {
    const raw = await provider.generate({
      system: "task:comparative_synthesis",
      messages: [
        {
          role: "user",
          content:
            "TOPIC: Hormuz\n1. [Reuters] US helicopter near Hormuz\n2. [Al Jazeera] Iran denies incident",
        },
      ],
      jsonSchemaHint: "json",
    });
    const parsed = JSON.parse(raw);
    expect(parsed).toHaveProperty("commonFacts");
    expect(parsed).toHaveProperty("disagreements");
    expect(parsed).toHaveProperty("framingDifferences");
    expect(parsed).toHaveProperty("missingContext");
  });
});
