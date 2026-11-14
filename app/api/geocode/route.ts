import { z } from "zod";
import { cacheKey, getAnalysisCache } from "@/lib/analysis/cache";
import { toSourceErrorInfo } from "@/lib/analysis/errors";
import { clientIdFrom, createRateLimiter } from "@/lib/analysis/rate-limit";
import type { ApiError, ApiResponse } from "@/lib/analysis/types";
import { GEOCODER_ATTRIBUTION, searchPlaces, type PlaceResult } from "@/lib/geocode/nominatim";

/**
 * GET /api/geocode?q=<place>&lang=<es|en>
 *
 * Finds places by name so a person can jump to a town before choosing a plot.
 * It proxies OpenStreetMap's search, caches every answer and limits how often
 * one visitor can search, as that service's usage policy requires.
 */

interface GeocodeData {
  readonly query: string;
  readonly results: readonly PlaceResult[];
  readonly attribution: string;
  readonly fromCache: boolean;
}

const querySchema = z.object({
  q: z.string().trim().min(2).max(120),
  lang: z.enum(["es", "en"]).default("es"),
});

const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;
const limiter = createRateLimiter(30, 300);

function respond<T>(status: number, body: ApiResponse<T>, headers?: HeadersInit): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

function fail(status: number, error: ApiError, headers?: HeadersInit): Response {
  return respond<never>(status, { success: false, data: null, error }, headers);
}

export async function GET(request: Request): Promise<Response> {
  const limit = limiter.check(clientIdFrom(request.headers), new Date());
  if (!limit.allowed) {
    return fail(
      429,
      { code: "rate-limited", message: "Too many searches in a short time. Try again in a moment." },
      { "retry-after": String(limit.retryAfterSeconds) },
    );
  }

  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({ q: params.get("q") ?? "", lang: params.get("lang") ?? undefined });
  if (!parsed.success) {
    return fail(400, {
      code: "invalid-request",
      message: "Write at least two letters of the place you are looking for.",
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
  }

  const { q, lang } = parsed.data;
  const cache = getAnalysisCache();
  const key = cacheKey({ geocode: q.toLowerCase(), lang });
  const now = new Date();

  const cached = await cache.get<readonly PlaceResult[]>(key, now);
  if (cached) {
    return respond<GeocodeData>(200, {
      success: true,
      data: { query: q, results: cached.value, attribution: GEOCODER_ATTRIBUTION, fromCache: true },
      error: null,
    });
  }

  try {
    const results = await searchPlaces(q, lang, request.signal);
    await cache.set(key, results, CACHE_TTL_SECONDS, now);
    return respond<GeocodeData>(200, {
      success: true,
      data: { query: q, results, attribution: GEOCODER_ATTRIBUTION, fromCache: false },
      error: null,
    });
  } catch (error) {
    // The detail stays in the server; the visitor gets a plain message.
    const info = toSourceErrorInfo(error);
    const status = info.code === "rate-limited" ? 429 : 502;
    return fail(status, { code: "internal", message: "The place search is not available right now." });
  }
}
