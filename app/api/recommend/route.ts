import { z } from "zod";
import { createRateLimiter } from "@/lib/analysis/rate-limit";
import { checkAdvice, type Advice } from "@/lib/explain/advice";
import { adviceModel, isAdviceConfigured } from "@/lib/explain/claude";
import { generateChecked } from "@/lib/explain/generate";
import { advicePrompt, factsMessage } from "@/lib/explain/prompts";
import {
  baseBody,
  dailyLimiter,
  dailyLimitReached,
  discarded,
  GENERATED_TTL_SECONDS,
  generatedKey,
  openAnalysis,
  providerFailure,
  succeed,
} from "@/lib/explain/route-kit";

/**
 * GET  /api/recommend — tells the interface whether the language model is available.
 * POST /api/recommend — writes recommendations for an analysis, each with its reason.
 *
 * Built only from results this server already computed and cached. Every figure
 * in the generated text is checked against the analysis, and a text with any
 * other figure is discarded.
 */

export const maxDuration = 180;

interface RecommendData extends Advice {
  readonly analysisId: string;
  readonly model: string;
  /** How many results the recommendations were written from. */
  readonly factCount: number;
  readonly generatedAt: string;
}

const bodySchema = z.strictObject(baseBody);
const limiter = createRateLimiter(15, 300);
const daily = dailyLimiter(400);

export async function GET(): Promise<Response> {
  return succeed<{ available: boolean }>({ available: isAdviceConfigured() });
}

export async function POST(request: Request): Promise<Response> {
  const opened = await openAnalysis(request, bodySchema, limiter);
  if (!opened.ok) return opened.response;
  const { context } = opened;
  const { facts, locale, cache, now } = context;

  const key = generatedKey("advice", context);
  const saved = await cache.get<RecommendData>(key, now);
  if (saved) return succeed(saved.value);
  if (!daily.allow(now)) return dailyLimitReached();

  const label = `recommend ${context.id}`;
  try {
    const advice = await generateChecked(
      label,
      [
        { role: "system", content: advicePrompt(locale) },
        { role: "user", content: factsMessage(facts) },
      ],
      (raw) => checkAdvice(raw, facts, locale),
      request.signal,
    );
    if (advice === null) return discarded();

    const data: RecommendData = {
      ...advice,
      analysisId: context.id,
      model: adviceModel(),
      factCount: facts.facts.length,
      generatedAt: now.toISOString(),
    };
    await cache.set(key, data, GENERATED_TTL_SECONDS, now);
    return succeed(data);
  } catch (error) {
    return providerFailure(label, error);
  }
}
