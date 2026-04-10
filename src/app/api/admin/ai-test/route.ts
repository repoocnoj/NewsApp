import { NextResponse } from "next/server";
import { getProvider } from "@/lib/ai";

/**
 * Diagnostic endpoint that actually invokes the configured AI provider
 * with a trivial prompt and reports what happened. Use this to tell
 * whether the production AI provider is actually working — the health
 * endpoint only checks env var presence, not that the credentials
 * authenticate successfully against Anthropic/OpenAI.
 *
 *   https://<your-app>.vercel.app/api/admin/ai-test?token=<SEED_TOKEN>
 *
 * Response includes:
 *   - which provider is configured
 *   - which provider was actually instantiated
 *   - whether the API call succeeded
 *   - the raw reply or the error text
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: Request) {
  const expected = process.env.SEED_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "SEED_TOKEN is not configured on the server." },
      { status: 503 },
    );
  }
  const url = new URL(req.url);
  const supplied =
    url.searchParams.get("token") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!supplied || supplied !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const env = {
    aiProvider: process.env.AI_PROVIDER || "(unset)",
    aiModel: process.env.AI_MODEL || "(default)",
    openaiKeySet: !!process.env.OPENAI_API_KEY,
    openaiKeyPrefix: maskKey(process.env.OPENAI_API_KEY),
    anthropicKeySet: !!process.env.ANTHROPIC_API_KEY,
    anthropicKeyPrefix: maskKey(process.env.ANTHROPIC_API_KEY),
  };

  let instantiatedProvider = "unknown";
  try {
    const provider = getProvider();
    instantiatedProvider = provider.name;
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        env,
        stage: "instantiate",
        error: (err as Error).message,
      },
      { status: 500 },
    );
  }

  // Fire a trivial call and measure what happens.
  try {
    const provider = getProvider();
    const started = Date.now();
    const reply = await provider.generate({
      system: "You are a diagnostic probe. Respond with exactly the single word: pong",
      messages: [{ role: "user", content: "ping" }],
      temperature: 0,
      maxTokens: 16,
    });
    const tookMs = Date.now() - started;
    return NextResponse.json({
      ok: true,
      env,
      instantiatedProvider,
      tookMs,
      reply: reply.trim().slice(0, 500),
      diagnosis:
        instantiatedProvider === "mock"
          ? "Provider fell back to MOCK. The env vars exist but getProvider() chose mock — most likely AI_PROVIDER is not set exactly to 'openai' or 'anthropic', or the corresponding API key env var is empty/falsy at request time."
          : reply.trim().toLowerCase().includes("pong")
            ? "Real AI provider is working. Replies with the expected probe response."
            : "Real AI provider responded, but with unexpected content. This is usually fine — the model may have added pleasantries.",
    });
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json(
      {
        ok: false,
        env,
        instantiatedProvider,
        stage: "generate",
        error: message,
        diagnosis: diagnoseError(message),
      },
      { status: 500 },
    );
  }
}

function maskKey(k?: string): string {
  if (!k) return "(unset)";
  const clean = k.trim();
  if (clean.length < 12) return "(too short)";
  return `${clean.slice(0, 8)}…${clean.slice(-4)} (len=${clean.length})`;
}

function diagnoseError(message: string): string {
  if (/401/i.test(message) || /unauthorized/i.test(message) || /invalid.*key/i.test(message)) {
    return "401 Unauthorized — the API key is invalid, expired, or doesn't have access to the requested model. Double-check the key in Vercel env vars (no leading/trailing whitespace).";
  }
  if (/404/i.test(message) || /not.*found/i.test(message) || /model/i.test(message)) {
    return "Model not found. The default model ID may be invalid for your account. Set AI_MODEL explicitly in env vars (e.g. claude-sonnet-4-6 or claude-haiku-4-5-20251001 for Anthropic; gpt-4o-mini for OpenAI).";
  }
  if (/429/i.test(message) || /rate.*limit/i.test(message)) {
    return "Rate limited. The key works; you've hit a quota. Try again in a moment.";
  }
  if (/ENOTFOUND/i.test(message) || /ECONNREFUSED/i.test(message)) {
    return "Network error reaching the provider. This is unusual on Vercel — likely a temporary outage.";
  }
  return "Unrecognized error. Paste this to the developer for diagnosis.";
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
