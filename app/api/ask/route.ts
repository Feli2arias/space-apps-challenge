import { z } from "zod";
import { createRateLimiter } from "@/lib/analysis/rate-limit";
import type { Advice } from "@/lib/explain/advice";
import { checkAnswer, MAX_HISTORY_TURNS, MAX_QUESTION_LENGTH, type ChatAnswer } from "@/lib/explain/chat";
import type { ChatMessage } from "@/lib/explain/claude";
import { generateChecked } from "@/lib/explain/generate";
import { chatPrompt, factsMessage } from "@/lib/explain/prompts";
import {
  baseBody,
  dailyLimiter,
  dailyLimitReached,
  generatedKey,
  openAnalysis,
  providerFailure,
  succeed,
} from "@/lib/explain/route-kit";

/**
 * POST /api/ask — answers one question about an analysis and its recommendations.
 *
 * The model receives only the results this server computed for that analysis
 * (never the coordinates) and the recommendations already given. Its answer
 * passes the same checks as every generated text: a figure that is not in the
 * analysis, or a source without results, and the answer is discarded.
 */

export const maxDuration = 180;

/** `answer` is null when the generated text was discarded by the checks. */
type AskData = ChatAnswer | { readonly answer: null; readonly answerable: false; readonly basedOn: [] };

const line = (max: number) => z.string().trim().min(1).max(max);

const bodySchema = z.strictObject({
  ...baseBody,
  question: line(MAX_QUESTION_LENGTH),
  /** Earlier questions and answers of this conversation, oldest first. */
  history: z
    .array(z.strictObject({ question: line(MAX_QUESTION_LENGTH), answer: line(1200) }))
    .max(MAX_HISTORY_TURNS)
    .default([]),
});

const limiter = createRateLimiter(20, 300);
const daily = dailyLimiter(1500);

export async function POST(request: Request): Promise<Response> {
  const opened = await openAnalysis(request, bodySchema, limiter);
  if (!opened.ok) return opened.response;
  const { context, body } = opened;
  const { facts, locale, cache, now } = context;
  if (!daily.allow(now)) return dailyLimitReached();

  // The recommendations are read from what this server saved, not from the browser.
  const advice = await cache.get<Advice>(generatedKey("advice", context), now);
  const conversation: ChatMessage[] = [
    { role: "system", content: chatPrompt(locale) },
    { role: "user", content: factsMessage(facts, advice?.value ?? null) },
    ...body.history.flatMap((turn): ChatMessage[] => [
      { role: "user", content: turn.question },
      { role: "assistant", content: JSON.stringify({ answer: turn.answer }) },
    ]),
    { role: "user", content: body.question },
  ];

  const label = `ask ${context.id}`;
  try {
    const answer = await generateChecked(
      label,
      conversation,
      (raw) => checkAnswer(raw, facts, locale),
      request.signal,
    );
    return succeed<AskData>(answer ?? { answer: null, answerable: false, basedOn: [] });
  } catch (error) {
    return providerFailure(label, error);
  }
}
