import { z } from "zod";
import { createRateLimiter } from "@/lib/analysis/rate-limit";
import { adviceModel } from "@/lib/explain/deepseek";
import { generateChecked } from "@/lib/explain/generate";
import { factsMessage, readingPrompt } from "@/lib/explain/prompts";
import { checkReading, type Reading } from "@/lib/explain/reading";
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
 * POST /api/reading — reads an analysis as a whole: a plain summary of what the
 * results indicate, and short points on what is favourable, what could be a
 * problem and what is worth checking. Built only from results this server
 * already computed; a text with any other figure is discarded.
 */

export const maxDuration = 180;

interface ReadingData extends Reading {
  readonly analysisId: string;
  readonly model: string;
  /** How many results the reading was written from. */
  readonly factCount: number;
  readonly generatedAt: string;
}

const bodySchema = z.strictObject(baseBody);
const limiter = createRateLimiter(15, 300);
const daily = dailyLimiter(400);

export async function POST(request: Request): Promise<Response> {
  const opened = await openAnalysis(request, bodySchema, limiter);
  if (!opened.ok) return opened.response;
  const { context } = opened;
  const { facts, locale, cache, now } = context;

  const key = generatedKey("reading", context);
  const saved = await cache.get<ReadingData>(key, now);
  if (saved) return succeed(saved.value);
  if (!daily.allow(now)) return dailyLimitReached();

  const label = `reading ${context.id}`;
  try {
    const reading = await generateChecked(
      label,
      [
        { role: "system", content: readingPrompt(locale) },
        { role: "user", content: factsMessage(facts) },
      ],
      (raw) => checkReading(raw, facts, locale),
      request.signal,
    );
    if (reading === null) return discarded();

    const data: ReadingData = {
      ...reading,
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
