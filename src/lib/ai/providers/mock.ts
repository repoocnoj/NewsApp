import type { AIProvider, GenerateOptions } from "../types";

/**
 * A deterministic local provider that powers the app without any API keys.
 *
 * It's intentionally not "AI" - it produces sensible, structured content
 * from the input it receives so all the AI-driven surfaces (summary,
 * comparison, contrarian view, timeline, chat) render with real text
 * during development, demos, and tests.
 */
export class MockProvider implements AIProvider {
  name = "mock";

  async generate(opts: GenerateOptions): Promise<string> {
    const last = opts.messages[opts.messages.length - 1]?.content ?? "";
    const system = opts.system ?? "";
    const hint = opts.jsonSchemaHint ?? "";

    // Route by task hint the service layer sends in the system prompt.
    if (/summarize_article/i.test(system)) return this.summarize(last);
    if (/comparative_synthesis/i.test(system)) return this.compare(last);
    if (/contrarian_view/i.test(system)) return this.contrarian(last);
    if (/timeline/i.test(system)) return this.timeline(last);
    if (/suggested_questions/i.test(system)) return this.suggested(last);
    if (/chat_over_article/i.test(system)) return this.chat(opts);

    // Generic fallback
    if (hint.includes("json")) {
      return JSON.stringify({ answer: "This is a mock AI response." });
    }
    return "This is a mock AI response. Configure AI_PROVIDER and set an API key for real generation.";
  }

  /* ---------- Task-specific stubs ---------- */

  private summarize(input: string) {
    const { headline, text } = extractArticle(input);
    const sentences = splitSentences(text);
    const short =
      sentences.slice(0, 2).join(" ").slice(0, 240) ||
      `Overview of: ${headline}`;
    const long =
      sentences.slice(0, 6).join(" ").slice(0, 900) ||
      `${headline}. This article discusses recent developments and relevant context drawn from the reporting.`;
    const keyPoints = sentences
      .slice(0, 5)
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter((s) => s.length > 20)
      .slice(0, 5);
    const entities = extractEntities(text + " " + headline);
    const topicTags = extractTopicTags(headline + " " + text);
    return JSON.stringify({
      short,
      long,
      keyPoints: keyPoints.length ? keyPoints : [headline || "Key development reported"],
      entities,
      topicTags,
    });
  }

  private compare(input: string) {
    const titles = extractTitles(input);
    const common = [
      "All cited sources agree the event took place and describe the same core actors.",
      "Reported timing and location are broadly consistent across outlets.",
    ];
    const disagreements = [
      {
        claim: "Cause and responsibility",
        sides: titles.slice(0, 3).map((t, i) => `${t}: attributes the incident differently (${i + 1}).`),
      },
      {
        claim: "Scale and impact",
        sides: ["Some sources emphasize casualties and damage; others emphasize strategic context."],
      },
    ];
    const framingDifferences = [
      "Western outlets foreground diplomatic and security framings.",
      "Regional outlets foreground local impact and historical grievances.",
    ];
    const missingContext = [
      "Independent on-the-ground verification is limited at time of publication.",
      "Prior incidents in the same region are rarely explained in full.",
    ];
    return JSON.stringify({ commonFacts: common, disagreements, framingDifferences, missingContext });
  }

  private contrarian(input: string) {
    const titles = extractTitles(input);
    return JSON.stringify({
      summary:
        "Alternative-perspective coverage frames the same events through a different interpretive lens, emphasizing context and actors that mainstream coverage downplays.",
      whyItDiffers:
        "Different editorial priors, geopolitical alignment, and access to different primary sources shift what is highlighted and what is omitted.",
      supportingUrls: titles.slice(0, 3).map((t) => ({ url: "#", label: t })),
    });
  }

  private timeline(input: string) {
    const now = Date.now();
    const day = 1000 * 60 * 60 * 24;
    const mk = (offset: number, title: string, description: string) => ({
      date: new Date(now - offset * day).toISOString(),
      title,
      description,
      sources: [] as Array<{ url: string; label: string }>,
    });
    return JSON.stringify([
      mk(365 * 2, "Background tensions", "Underlying tensions build over prior years with periodic flashpoints."),
      mk(180, "Escalation begins", "A precipitating incident shifts the pace of events."),
      mk(30, "Regional response", "Regional actors reposition and statements are issued."),
      mk(7, "Latest reporting", "Current coverage in the cited articles."),
    ]);
  }

  private suggested(input: string) {
    const tags = extractTopicTags(input).slice(0, 3);
    const base = [
      "What is corroborated across multiple independent sources?",
      "What claims are currently disputed or unverified?",
      "What is the historical context leading up to this?",
      "Which actors benefit most from the prevailing narrative?",
      "What would change your interpretation of this event?",
    ];
    const topical = tags.map((t) => `How does ${t} affect the broader picture?`);
    return JSON.stringify({ questions: [...topical, ...base].slice(0, 6) });
  }

  private chat(opts: GenerateOptions) {
    const lastUser = [...opts.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const context = opts.messages.find((m) => m.role === "system")?.content ?? "";
    const bullets = splitSentences(context).slice(0, 3);

    const answer =
      `Based on the cited reporting, here is a grounded answer to: "${truncate(lastUser, 140)}"\n\n` +
      bullets.map((b, i) => `• ${b.replace(/\s+/g, " ").trim()}`).join("\n") +
      `\n\nNote: this is a mock AI response used for local development. Configure an AI provider in .env to generate real answers. Where sources disagree, this app aims to flag that explicitly rather than assert certainty.`;
    return answer;
  }
}

/* ---------- Helpers ---------- */

function extractArticle(input: string): { headline: string; text: string } {
  const headlineMatch = input.match(/HEADLINE:\s*([^\n]+)/i);
  const textMatch = input.match(/TEXT:\s*([\s\S]+)$/i);
  return {
    headline: (headlineMatch?.[1] ?? "").trim(),
    text: (textMatch?.[1] ?? input).trim(),
  };
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function extractEntities(text: string): string[] {
  const matches = text.match(/\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})\b/g) ?? [];
  const common = new Set([
    "The","A","An","This","That","These","Those","However","Meanwhile","Reuters","AP","BBC","NPR","US","U.S.","UK","EU","UN"
  ]);
  const counts = new Map<string, number>();
  for (const m of matches) {
    const key = m.trim();
    if (common.has(key) || key.length < 3) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k]) => k);
}

function extractTopicTags(text: string): string[] {
  const lc = text.toLowerCase();
  const topics: Array<[string, string[]]> = [
    ["geopolitics", ["treaty", "diplomat", "sanction", "nato", "un ", "foreign", "embassy"]],
    ["conflict", ["war", "strike", "missile", "troops", "conflict", "helicopter", "tanks", "drone"]],
    ["middle-east", ["iran", "israel", "gaza", "hormuz", "tehran", "saudi", "yemen", "syria"]],
    ["energy", ["oil", "opec", "gas", "energy", "refinery", "crude", "barrel"]],
    ["markets", ["market", "stock", "bond", "yield", "inflation", "fed", "ecb"]],
    ["technology", ["ai", "chip", "semiconductor", "tech", "software", "cloud"]],
    ["climate", ["climate", "carbon", "emission", "warming"]],
    ["politics", ["election", "president", "prime minister", "parliament", "congress"]],
  ];
  const out: string[] = [];
  for (const [tag, kws] of topics) {
    if (kws.some((k) => lc.includes(k))) out.push(tag);
  }
  return out.slice(0, 5);
}

function extractTitles(input: string): string[] {
  return input
    .split(/\n+/)
    .map((l) => l.replace(/^[-•*\d.]+\s*/, "").trim())
    .filter((l) => l.length > 5 && l.length < 200)
    .slice(0, 6);
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
