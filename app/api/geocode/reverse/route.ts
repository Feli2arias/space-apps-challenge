import { z } from "zod";
import { cacheKey, getAnalysisCache } from "@/lib/analysis/cache";
import { toSourceErrorInfo } from "@/lib/analysis/errors";
import { clientIdFrom, createRateLimiter } from "@/lib/analysis/rate-limit";
import type { ApiError, ApiResponse } from "@/lib/analysis/types";
import { GEOCODER_ATTRIBUTION, lookupPlace, type PlaceName } from "@/lib/geocode/nominatim";

/**
 * GET /api/geocode/reverse?lat=<number>&lon=<number>&lang=<es|en>
 *
 * Says in words where a point is: town, region and country. It is used to
 * label the plot that was analysed. Like the place search, it proxies
 * OpenStreetMap, caches every answer and limits how often one visitor can ask.
 */

interface ReverseData extends PlaceName {
  readonly attribution: string;
  readonly fromCache: boolean;
}

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  lang: z.enum(["es", "en"]).default("es"),
});

const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;
/**
 * Points are grouped to two decimals (about 1 km) for the lookup: a town does
 * not change within that distance, and it keeps nearby plots on one answer.
 */
const LOOKUP_DECIMALS = 2;
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
      { code: "rate-limited", message: "Too many lookups in a short time. Try again in a moment." },
      { "retry-after": String(limit.retryAfterSeconds) },
    );
  }

  const params = new URL(request.url).searchParams;
  // An absent value must fail validation instead of being read as zero.
  const parsed = querySchema.safeParse({
    lat: params.get("lat") || undefined,
    lon: params.get("lon") || undefined,
    lang: params.get("lang") ?? undefined,
  });
  if (!parsed.success) {
    return fail(400, {
      code: "invalid-request",
      message: "Latitude and longitude are needed, as numbers.",
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
  }

  const { lang } = parsed.data;
  const lat = Number(parsed.data.lat.toFixed(LOOKUP_DECIMALS));
  const lon = Number(parsed.data.lon.toFixed(LOOKUP_DECIMALS));
  const cache = getAnalysisCache();
  const key = cacheKey({ reverse: [lat, lon], lang });
  const now = new Date();

  const cached = await cache.get<PlaceName>(key, now);
  if (cached) {
    return respond<ReverseData>(200, {
      success: true,
      data: { ...cached.value, attribution: GEOCODER_ATTRIBUTION, fromCache: true },
      error: null,
    });
  }

  try {
    const place = await lookupPlace(lat, lon, lang, request.signal);
    await cache.set(key, place, CACHE_TTL_SECONDS, now);
    return respond<ReverseData>(200, {
      success: true,
      data: { ...place, attribution: GEOCODER_ATTRIBUTION, fromCache: false },
      error: null,
    });
  } catch (error) {
    // The detail stays in the server; the visitor gets a plain message.
    const info = toSourceErrorInfo(error);
    const status = info.code === "rate-limited" ? 429 : 502;
    return fail(status, { code: "internal", message: "The place lookup is not available right now." });
  }
}
