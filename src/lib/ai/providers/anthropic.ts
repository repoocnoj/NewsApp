import type { AIProvider, GenerateOptions } from "../types";

export class AnthropicProvider implements AIProvider {
  name = "anthropic";

  constructor(
    private readonly apiKey: string,
    private readonly model: string = process.env.AI_MODEL || "claude-sonnet-4-6",
  ) {}

  async generate(opts: GenerateOptions): Promise<string> {
    // Anthropic Messages API — conversation messages are user/assistant only;
    // the system prompt is passed as a top-level field.
    const messages = opts.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    const body: Record<string, unknown> = {
      model: this.model,
      system: opts.system || undefined,
      messages,
      max_tokens: opts.maxTokens ?? 900,
      temperature: opts.temperature ?? 0.2,
    };

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic error ${res.status}: ${text}`);
    }
    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (json.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text || "")
      .join("\n");
    return text;
  }
}
