import { z } from "zod";
import { readJsonBody } from "@/lib/analysis/body";
import { cacheKey, getAnalysisCache, type CacheStore } from "@/lib/analysis/cache";
import { toSourceErrorInfo } from "@/lib/analysis/errors";
import { analysisId, readCachedSources } from "@/lib/analysis/orchestrator";
import { lastFullYears } from "@/lib/analysis/period";
import { clientIdFrom, createRateLimiter } from "@/lib/analysis/rate-limit";
import { parseAnalysisRequest } from "@/lib/analysis/schema";
import { SOURCES } from "@/lib/analysis/sources";
import type { ApiError, ApiResponse } from "@/lib/analysis/types";
import type { Locale } from "@/lib/site";
import { adviceModel, isAdviceConfigured } from "./deepseek";
import { buildFacts, type AnalysisFacts } from "./facts";
import { PROMPT_VERSION } from "./prompts";

/**
 * What the three language-model routes share: how they answer, how they read
 * the request, and how they find the results the text will be written from.
 * The browser sends only which area and period it is looking at, never the
 * numbers: those are read from what this server already computed and saved.
 */

export const MAX_BODY_BYTES = 20_000;
/** Generated texts for the same analysis and language are written once and then reused. */
export const GENERATED_TTL_SECONDS = 7 * 24 * 60 * 60;

type Limiter = ReturnType<typeof createRateLimiter>;

export function respond<T>(status: number, body: ApiResponse<T>, headers?: HeadersInit): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

export function fail(status: number, error: ApiError, headers?: HeadersInit): Response {
  return respond<never>(status, { success: false, data: null, error }, headers);
}

export function succeed<T>(data: T): Response {
  return respond<T>(200, { success: true, data, error: null });
}

/** What every request to these routes carries, besides its own fields. */
export const baseBody = {
  /** The same body that was sent to POST /api/analysis. */
  request: z.unknown(),
  locale: z.enum(["es", "en"]),
};

export interface AnalysisContext {
  readonly id: string;
  readonly locale: Locale;
  readonly facts: AnalysisFacts;
  readonly cache: CacheStore;
  readonly now: Date;
}

export type Opened<T> =
  | { readonly ok: true; readonly body: T; readonly context: AnalysisContext }
  | { readonly ok: false; readonly response: Response };

/**
 * Runs the checks common to every route (key present, rate limit, valid body,
 * saved results) and returns the facts of the analysis the request points at.
 */
export async function openAnalysis<T extends { request: unknown; locale: Locale }>(
  request: Request,
  schema: z.ZodType<T>,
  limiter: Limiter,
): Promise<Opened<T>> {
  const refuse = (response: Response): Opened<T> => ({ ok: false, response });

  if (!isAdviceConfigured()) {
    return refuse(fail(503, { code: "not-found", message: "The language model is not configured." }));
  }

  const now = new Date();
  const limit = limiter.check(clientIdFrom(request.headers), now);
  if (!limit.allowed) {
    return refuse(
      fail(
        429,
        { code: "rate-limited", message: "Too many requests in a short time. Try again in a moment." },
        { "retry-after": String(limit.retryAfterSeconds) },
      ),
    );
  }

  const input = await readJsonBody(request, MAX_BODY_BYTES);
  const body = schema.safeParse(input.ok ? input.value : null);
  const parsed = body.success ? parseAnalysisRequest(body.data.request) : null;
  if (!body.success || !parsed || !parsed.ok) {
    return refuse(fail(400, { code: "invalid-request", message: "The request is not valid." }));
  }

  const { locale } = body.data;
  const period = lastFullYears(parsed.request.years, now);
  const cache = getAnalysisCache();
  const results = await readCachedSources(parsed.area, period, SOURCES, cache, now);
  const facts = buildFacts(results, parsed.area, period, locale);
  if (facts.facts.length === 0) {
    return refuse(
      fail(409, {
        code: "not-found",
        message: "There are no saved results for this area yet. Run the analysis first.",
      }),
    );
  }

  return {
    ok: true,
    body: body.data,
    context: { id: analysisId(parsed.area, period), locale, facts, cache, now },
  };
}

/**
 * Where a generated text is saved. The key includes which results exist, so a
 * text written while a source was missing is not reused once that source has data.
 */
export function generatedKey(kind: "reading" | "advice", context: AnalysisContext): string {
  return cacheKey({
    kind,
    analysis: context.id,
    locale: context.locale,
    model: adviceModel(),
    prompt: PROMPT_VERSION,
    facts: context.facts.facts,
    monthly: context.facts.monthly,
  });
}

/** Ceiling per day for the whole server, so the language-model bill stays bounded. */
export function dailyLimiter(limit: number): { readonly allow: (now: Date) => boolean } {
  const limiter = createRateLimiter(limit, 24 * 60 * 60);
  return { allow: (now) => limiter.check("all-visitors", now).allowed };
}

export function dailyLimitReached(): Response {
  return fail(429, {
    code: "rate-limited",
    message: "The daily number of generated texts has been reached. Try again tomorrow.",
  });
}

export function discarded(): Response {
  return fail(502, {
    code: "internal",
    message: "The text was discarded because it did not pass the checks against the analysis.",
  });
}

/** The technical detail stays on the server; it could mention the provider. */
export function providerFailure(label: string, error: unknown): Response {
  const info = toSourceErrorInfo(error);
  console.error(`[${label}] failed: ${info.code} — ${info.detail}`);
  return fail(info.code === "rate-limited" ? 429 : 502, {
    code: "internal",
    message: "The text could not be generated right now.",
  });
}
