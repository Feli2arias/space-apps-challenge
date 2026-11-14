import { z } from "zod";
import { readJsonBody } from "@/lib/analysis/body";
import { cacheKey, getAnalysisCache } from "@/lib/analysis/cache";
import { analysisId, readCachedSources } from "@/lib/analysis/orchestrator";
import { lastFullYears } from "@/lib/analysis/period";
import { clientIdFrom, createRateLimiter } from "@/lib/analysis/rate-limit";
import { parseAnalysisRequest } from "@/lib/analysis/schema";
import { SOURCES } from "@/lib/analysis/sources";
import type { ApiError, ApiResponse } from "@/lib/analysis/types";
import type { Advice } from "@/lib/explain/advice";
import { buildFacts } from "@/lib/explain/facts";
import type { Reading } from "@/lib/explain/reading";
import { generatedKey } from "@/lib/explain/route-kit";
import type { PlaceName } from "@/lib/geocode/nominatim";
import { buildPlotReport } from "@/lib/report/model";
import { renderPlotReport } from "@/lib/report/pdf";
import { REPORT_WORDS } from "@/lib/report/words";

/**
 * POST /api/report — the results of an analysis as a PDF file.
 *
 * Like the other routes that describe an analysis, it receives only which area
 * and period the browser is looking at and writes the file from the results
 * this server computed and saved. The generated texts (reading and
 * recommendations) are included only when they were already written; the
 * place name only when it was already looked up. Nothing is queried here.
 */

const bodySchema = z.strictObject({
  /** The same body that was sent to POST /api/analysis. */
  request: z.unknown(),
  locale: z.enum(["es", "en"]),
});

const MAX_BODY_BYTES = 20_000;
/** Must match the rounding of GET /api/geocode/reverse, which saves the place names. */
const PLACE_DECIMALS = 2;
const limiter = createRateLimiter(20, 300);

function fail(status: number, error: ApiError, headers?: HeadersInit): Response {
  const body: ApiResponse<never> = { success: false, data: null, error };
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

/** "Los Chiles, Alajuela, Costa Rica"; repeated names are written once. */
function placeLine(place: PlaceName | undefined): string | null {
  if (!place) return null;
  const parts = [place.locality, place.region, place.country].filter((part): part is string => part !== null);
  const unique = parts.filter((part, index) => parts.indexOf(part) === index);
  return unique.length > 0 ? unique.join(", ") : null;
}

export async function POST(request: Request): Promise<Response> {
  const now = new Date();
  const limit = limiter.check(clientIdFrom(request.headers), now);
  if (!limit.allowed) {
    return fail(
      429,
      { code: "rate-limited", message: "Too many downloads in a short time. Try again in a moment." },
      { "retry-after": String(limit.retryAfterSeconds) },
    );
  }

  const input = await readJsonBody(request, MAX_BODY_BYTES);
  const body = bodySchema.safeParse(input.ok ? input.value : null);
  const parsed = body.success ? parseAnalysisRequest(body.data.request) : null;
  if (!body.success || !parsed || !parsed.ok) {
    return fail(400, { code: "invalid-request", message: "The request is not valid." });
  }

  const { locale } = body.data;
  const { area } = parsed;
  const period = lastFullYears(parsed.request.years, now);
  const cache = getAnalysisCache();
  const results = await readCachedSources(area, period, SOURCES, cache, now);
  const facts = buildFacts(results, area, period, locale);
  if (facts.facts.length === 0) {
    return fail(409, {
      code: "not-found",
      message: "There are no saved results for this area yet. Run the analysis first.",
    });
  }

  const id = analysisId(area, period);
  const context = { id, locale, facts, cache, now };
  const lat = Number(area.center.lat.toFixed(PLACE_DECIMALS));
  const lon = Number(area.center.lon.toFixed(PLACE_DECIMALS));
  const [reading, advice, place] = await Promise.all([
    cache.get<Reading>(generatedKey("reading", context), now),
    cache.get<Advice>(generatedKey("advice", context), now),
    cache.get<PlaceName>(cacheKey({ reverse: [lat, lon], lang: locale }), now),
  ]);

  try {
    const report = buildPlotReport({
      area,
      period,
      results,
      locale,
      place: placeLine(place?.value),
      reading: reading?.value ?? null,
      advice: advice?.value ?? null,
      generatedAt: now,
    });
    const bytes = await renderPlotReport(report);
    const fileName = `${REPORT_WORDS[locale].fileName}-${id}.pdf`;
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${fileName}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error(`[report ${id}] failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return fail(500, { code: "internal", message: "The report could not be generated right now." });
  }
}
