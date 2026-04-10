/**
 * Provider-agnostic types for the AI service layer.
 * Any provider implementation (OpenAI, Anthropic, mock) must implement
 * `AIProvider` so the rest of the app stays provider-agnostic.
 */

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface GenerateOptions {
  system?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /**
   * When set, the provider will try to coerce the response into JSON
   * matching the described shape. Callers always re-parse defensively.
   */
  jsonSchemaHint?: string;
}

export interface AIProvider {
  name: string;
  generate(opts: GenerateOptions): Promise<string>;
}

/* ---------- Structured outputs used by the app ---------- */

export interface ArticleSummary {
  short: string;
  long: string;
  keyPoints: string[];
  entities: string[];
  topicTags: string[];
}

export interface ComparativeSynthesis {
  commonFacts: string[];
  disagreements: Array<{ claim: string; sides: string[] }>;
  framingDifferences: string[];
  missingContext: string[];
}

export interface ContrarianView {
  summary: string;
  whyItDiffers: string;
  supportingUrls: Array<{ url: string; label: string }>;
}

export interface TimelineEvent {
  date: string; // ISO
  title: string;
  description: string;
  sources: Array<{ url: string; label: string }>;
}

export interface SuggestedQuestions {
  questions: string[];
}
