import { z } from "zod";
import { SourceError } from "@/lib/analysis/errors";
import { requestJson } from "@/lib/analysis/http";

/**
 * Minimal client of the DeepSeek chat API (https://api-docs.deepseek.com),
 * asking for a JSON object as the answer. The key is read from the environment
 * on the server and never reaches the browser.
 */

const API_URL = "https://api.deepseek.com/chat/completions";
/**
 * Can be changed without touching the code by setting DEEPSEEK_MODEL. The
 * names come from GET https://api.deepseek.com/models (checked 14 Nov 2026).
 */
const DEFAULT_MODEL = "deepseek-flash";
/**
 * The model reasons before answering and that reasoning counts as output, so
 * the ceiling is well above the length of the answer itself.
 */
const MAX_OUTPUT_TOKENS = 16_000;
/** "low", "high" or "max". Low keeps the wait short; the answer is checked afterwards anyway. */
const REASONING_EFFORT = "low";
const TIMEOUT_MS = 80_000;

export interface ChatMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

const responseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable() }),
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .min(1),
});

/** True when the server has a key for the language model. */
export function isAdviceConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

export function adviceModel(): string {
  return process.env.DEEPSEEK_MODEL || DEFAULT_MODEL;
}

/** The answer's text. Exported so the parsing can be tested without a key. */
export function contentOfResponse(raw: unknown): string {
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new SourceError("bad-response", "The language model answered in an unexpected format.");
  }
  const [choice] = parsed.data.choices;
  if (choice.finish_reason === "length") {
    throw new SourceError("bad-response", "The language model ran out of room before finishing.");
  }
  const text = (choice.message.content ?? "").trim();
  if (text === "") throw new SourceError("bad-response", "The language model returned no text.");
  return text;
}

/** Sends the conversation and returns the answer, which the caller parses as JSON. */
export async function askDeepSeek(
  messages: readonly ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new SourceError("not-configured", "DEEPSEEK_API_KEY is not set on the server.");
  }

  const raw = await requestJson(API_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: {
      model: adviceModel(),
      messages,
      response_format: { type: "json_object" },
      max_tokens: MAX_OUTPUT_TOKENS,
      reasoning_effort: REASONING_EFFORT,
      stream: false,
    },
    timeoutMs: TIMEOUT_MS,
    retries: 1,
    signal,
  });
  return contentOfResponse(raw);
}
