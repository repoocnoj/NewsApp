import type {
  AIProvider,
  ArticleSummary,
  ChatMessage,
  ComparativeSynthesis,
  ContrarianView,
  GenerateOptions,
  SuggestedQuestions,
  TimelineEvent,
} from "./types";
import { MockProvider } from "./providers/mock";
import { OpenAIProvider } from "./providers/openai";
import { AnthropicProvider } from "./providers/anthropic";

/**
 * Provider selection:
 *   AI_PROVIDER = "openai" | "anthropic" | "mock" (default "mock")
 * Missing API keys silently fall back to the mock provider so that the
 * app is always runnable without external credentials.
 */
export function getProvider(): AIProvider {
  const which = (process.env.AI_PROVIDER || "mock").toLowerCase();
  if (which === "openai" && process.env.OPENAI_API_KEY) {
    return new OpenAIProvider(process.env.OPENAI_API_KEY);
  }
  if (which === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
  }
  return new MockProvider();
}

function tryParseJson<T>(raw: string, fallback: T): T {
  if (!raw) return fallback;
  // Strip code fences if any
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Try to find the first JSON object/array in the response
    const m = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {}
    }
    return fallback;
  }
}

export const ai = {
  async summarizeArticle(input: {
    headline: string;
    text: string;
  }): Promise<ArticleSummary> {
    const provider = getProvider();
    const system = `task:summarize_article
You are a precise news analyst. Produce a concise and accurate summary of the article.
Return ONLY JSON matching: { short: string, long: string, keyPoints: string[], entities: string[], topicTags: string[] }.
- short: one or two sentences, ~200 chars max
- long: 4-6 sentences, neutral, no speculation
- keyPoints: up to 5 bullets
- entities: named entities (people/places/orgs)
- topicTags: 2-5 lowercase kebab-case tags`;
    const prompt = `HEADLINE: ${input.headline}\nTEXT: ${input.text}`;
    const raw = await provider.generate({
      system,
      messages: [{ role: "user", content: prompt }],
      jsonSchemaHint: "json",
      temperature: 0.1,
    });
    return tryParseJson<ArticleSummary>(raw, {
      short: input.headline,
      long: input.text.slice(0, 600),
      keyPoints: [],
      entities: [],
      topicTags: [],
    });
  },

  async comparativeSynthesis(input: {
    topic: string;
    articles: Array<{ source: string; headline: string; summary: string }>;
  }): Promise<ComparativeSynthesis> {
    const provider = getProvider();
    const system = `task:comparative_synthesis
You are a truth-seeking analyst. Given multiple related articles, identify:
- common facts corroborated across sources
- important disagreements with which side takes which view
- framing differences (emphasis, tone, implication)
- missing context that readers should know

IMPORTANT: Do not manufacture certainty. If sources genuinely agree, say so. If they disagree, attribute claims.
Return ONLY JSON: { commonFacts: string[], disagreements: Array<{ claim: string, sides: string[] }>, framingDifferences: string[], missingContext: string[] }`;
    const body = input.articles
      .map((a, i) => `${i + 1}. [${a.source}] ${a.headline}\n   ${a.summary}`)
      .join("\n");
    const raw = await provider.generate({
      system,
      messages: [{ role: "user", content: `TOPIC: ${input.topic}\n\nARTICLES:\n${body}` }],
      jsonSchemaHint: "json",
      temperature: 0.2,
    });
    return tryParseJson<ComparativeSynthesis>(raw, {
      commonFacts: [],
      disagreements: [],
      framingDifferences: [],
      missingContext: [],
    });
  },

  async contrarianView(input: {
    topic: string;
    mainstreamSummary: string;
    contrarianArticles: Array<{ source: string; headline: string; url: string; summary: string }>;
  }): Promise<ContrarianView> {
    const provider = getProvider();
    const system = `task:contrarian_view
You analyze alternative-perspective reporting. Given mainstream coverage and contrarian/geopolitically distinct articles, explain:
- the contrarian interpretation
- why it differs (access, priors, editorial context)
- which articles support it
Do not endorse or dismiss. Be neutral and transparent about uncertainty.
Return ONLY JSON: { summary: string, whyItDiffers: string, supportingUrls: Array<{ url: string, label: string }> }`;
    const body = input.contrarianArticles
      .map((a) => `- [${a.source}] ${a.headline} (${a.url})\n  ${a.summary}`)
      .join("\n");
    const raw = await provider.generate({
      system,
      messages: [
        {
          role: "user",
          content: `TOPIC: ${input.topic}\nMAINSTREAM: ${input.mainstreamSummary}\n\nCONTRARIAN ARTICLES:\n${body}`,
        },
      ],
      jsonSchemaHint: "json",
      temperature: 0.2,
    });
    return tryParseJson<ContrarianView>(raw, {
      summary: "",
      whyItDiffers: "",
      supportingUrls: input.contrarianArticles.map((a) => ({ url: a.url, label: a.headline })),
    });
  },

  async timeline(input: {
    topic: string;
    articles: Array<{ source: string; url: string; headline: string; publishedAt: string; summary: string }>;
  }): Promise<TimelineEvent[]> {
    const provider = getProvider();
    const system = `task:timeline
You build neutral, dated timelines from cited articles. Include events the articles clearly reference.
Return ONLY JSON array: Array<{ date: ISO string, title: string, description: string, sources: Array<{ url, label }> }>.
Order chronologically (oldest first). Prefer 4-8 events. Do not fabricate dates.`;
    const body = input.articles
      .map((a) => `- [${a.source}] ${a.publishedAt} — ${a.headline} (${a.url})\n  ${a.summary}`)
      .join("\n");
    const raw = await provider.generate({
      system,
      messages: [{ role: "user", content: `TOPIC: ${input.topic}\n\nSOURCES:\n${body}` }],
      jsonSchemaHint: "json",
      temperature: 0.2,
    });
    return tryParseJson<TimelineEvent[]>(raw, []);
  },

  async suggestedQuestions(input: {
    topic: string;
    headline: string;
    summary: string;
  }): Promise<SuggestedQuestions> {
    const provider = getProvider();
    const system = `task:suggested_questions
You generate deep, useful follow-up questions a reader would ask to get closer to ground truth.
Return ONLY JSON: { questions: string[] }. 5-6 questions, diverse angles (historical context, corroboration, dispute, skepticism, stakes, implications).`;
    const raw = await provider.generate({
      system,
      messages: [
        {
          role: "user",
          content: `TOPIC: ${input.topic}\nHEADLINE: ${input.headline}\nSUMMARY: ${input.summary}`,
        },
      ],
      jsonSchemaHint: "json",
      temperature: 0.4,
    });
    return tryParseJson<SuggestedQuestions>(raw, { questions: [] });
  },

  async chatOverArticle(input: {
    article: { headline: string; source: string; summary: string; text: string; url: string };
    related: Array<{ source: string; headline: string; url: string; summary: string }>;
    history: ChatMessage[];
    userMessage: string;
  }): Promise<string> {
    const provider = getProvider();
    const system = `task:chat_over_article
You are an expert research assistant helping a user understand a news story.

YOUR APPROACH:
1. First, draw on the PROVIDED ARTICLE and RELATED COVERAGE below. Cite these as specific sources with their names, e.g. "According to Reuters (${input.article.url})..."
2. Then, go BEYOND the articles using your own broad knowledge to provide fuller context: historical background, geopolitical significance, economic implications, expert perspectives, and anything else that helps the user understand. When drawing on general knowledge, say so clearly, e.g. "Based on historical context..." or "Experts in this field generally note..."
3. Always distinguish between:
   - Facts reported by multiple sources (strong evidence)
   - Claims from a single source (note which one)
   - Your contextual knowledge (label it as background/context)
   - Disputed or uncertain claims (flag clearly)

FORMATTING:
- Use clear headers and bullet points for readability.
- Include source names and URLs when citing the provided articles.
- For your broader knowledge, explain what you know and acknowledge the limits of your training data.
- NEVER say "the context does not contain information about..." — instead, answer to the best of your ability and clearly indicate what comes from the articles vs. your broader knowledge.
- Be substantive and thorough. The user wants a real answer, not a disclaimer.

PRIMARY ARTICLE:
[${input.article.source}] ${input.article.headline}
URL: ${input.article.url}
SUMMARY: ${input.article.summary}
FULL TEXT EXCERPT:
${input.article.text.slice(0, 3000)}

RELATED COVERAGE FROM OTHER SOURCES:
${input.related.length > 0
  ? input.related
      .map((r) => `- [${r.source}] ${r.headline}\n  URL: ${r.url}\n  Summary: ${r.summary}`)
      .join("\n\n")
  : "(No related articles found from other sources for this story.)"}`;
    const opts: GenerateOptions = {
      system,
      messages: [
        ...input.history,
        { role: "user", content: input.userMessage },
      ],
      temperature: 0.4,
      maxTokens: 1200,
    };
    return provider.generate(opts);
  },
};
