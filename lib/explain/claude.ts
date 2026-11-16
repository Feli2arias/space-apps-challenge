import { z } from "zod";
import { SourceError } from "@/lib/analysis/errors";
import { requestJson } from "@/lib/analysis/http";

/**
 * Minimal client of the Anthropic Messages API
 * (https://docs.anthropic.com/en/api/messages). The key is read from the
 * environment on the server and never reaches the browser.
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
/**
 * The small, fast model of the family: the texts are short and every one is
 * checked against the analysis afterwards. Can be changed without touching the
 * code by setting ANTHROPIC_MODEL. The name comes from GET /v1/models
 * (checked 15 Nov 2026).
 */
const DEFAULT_MODEL = "claude-haiku-5-5";
/**
 * Room for the longest answer (five recommendations with their reasons, in
 * Spanish) plus any reasoning the model does first, which counts as output:
 * 2,500 was not enough in practice.
 */
const MAX_OUTPUT_TOKENS = 8_000;
const TIMEOUT_MS = 60_000;

export interface ChatMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

const responseSchema = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
  stop_reason: z.string().nullable().optional(),
});

/** True when the server has a key for the language model. */
export function isAdviceConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function adviceModel(): string {
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

/**
 * The JSON object inside an answer. The model is asked for nothing but the
 * object; if it still wraps it in a code fence or a sentence, the object is
 * taken from the first "{" to the last "}".
 */
export function jsonTextOf(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : text.trim();
}

/** The answer's text. Exported so the parsing can be tested without a key. */
export function contentOfResponse(raw: unknown): string {
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new SourceError("bad-response", "The language model answered in an unexpected format.");
  }
  if (parsed.data.stop_reason === "max_tokens") {
    throw new SourceError("bad-response", "The language model ran out of room before finishing.");
  }
  const text = parsed.data.content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("")
    .trim();
  if (text === "") throw new SourceError("bad-response", "The language model returned no text.");
  return jsonTextOf(text);
}

/**
 * Sends the conversation and returns the answer, which the caller parses as
 * JSON. The instructions travel in `system`, apart from the conversation.
 */
export async function askModel(
  messages: readonly ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new SourceError("not-configured", "ANTHROPIC_API_KEY is not set on the server.");
  }

  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const conversation = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({ role: message.role, content: message.content }));

  const raw = await requestJson(API_URL, {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": API_VERSION },
    body: { model: adviceModel(), max_tokens: MAX_OUTPUT_TOKENS, system, messages: conversation },
    timeoutMs: TIMEOUT_MS,
    retries: 1,
    signal,
  });
  return contentOfResponse(raw);
}
