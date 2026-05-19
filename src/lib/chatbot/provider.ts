export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CallChatCompletionOptions {
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

const DEFAULT_MODEL = "gpt-4o-mini";

function resolveOpenAiApiKey(): string | undefined {
  const directCandidates = [
    process.env.OPENAI_API_KEY,
    process.env.OPENAPI_API_KEY,
    process.env.openai_api_key,
    process.env.OPENAI_KEY,
    process.env.OPENAPI_KEY,
  ];
  for (const candidate of directCandidates) {
    const key = candidate?.trim();
    if (key) return key;
  }

  // Last-resort: accept common variants regardless of casing.
  const aliasSet = new Set([
    "OPENAI_API_KEY",
    "OPENAPI_API_KEY",
    "OPENAI_KEY",
    "OPENAPI_KEY",
    "OPEN_AI_API_KEY",
    "OPEN_AI_KEY",
    "OPENAIAPIKEY",
  ]);
  for (const [name, value] of Object.entries(process.env)) {
    const normalizedName = name.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (!aliasSet.has(normalizedName)) continue;
    const key = value?.trim();
    if (key) return key;
  }

  return undefined;
}

/**
 * OpenAI-compatible Chat Completions API (works with OpenAI and many proxies).
 */
export async function callOpenAICompatible(opts: CallChatCompletionOptions): Promise<string> {
  const apiKey = resolveOpenAiApiKey();
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured (common aliases are accepted, but OPENAI_API_KEY is recommended)",
    );
  }

  const baseUrl = (process.env.OPENAI_API_BASE || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = (process.env.OPENAI_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? 512,
      temperature: opts.temperature ?? 0.25,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Chat API error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty model response");
  return text;
}

export function isAiConfigured(): boolean {
  return Boolean(resolveOpenAiApiKey());
}
