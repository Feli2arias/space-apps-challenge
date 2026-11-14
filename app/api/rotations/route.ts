import { readJsonBody } from "@/lib/analysis/body";
import { clientIdFrom, createRateLimiter } from "@/lib/analysis/rate-limit";
import type { ApiError, ApiResponse } from "@/lib/analysis/types";
import { buildRotationComparison, type RotationComparisonResult } from "@/lib/rotation/compare";
import { parseRotationRequest } from "@/lib/rotation/schema";

/**
 * POST /api/rotations
 *
 * Compares the rotations a farmer declares for one plot: the published
 * evidence about the crop grown before the beans, and a relative reading of
 * how exposed the soil is to rain under each rotation. It calls no external
 * service: it works from the rainfall already obtained by the analysis.
 */

const MAX_BODY_BYTES = 10_000;
const limiter = createRateLimiter(60, 300);

function fail(status: number, error: ApiError, headers?: HeadersInit): Response {
  const body: ApiResponse<never> = { success: false, data: null, error };
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

export async function POST(request: Request): Promise<Response> {
  const limit = limiter.check(clientIdFrom(request.headers), new Date());
  if (!limit.allowed) {
    return fail(
      429,
      { code: "rate-limited", message: "Too many comparisons in a short time. Try again in a moment." },
      { "retry-after": String(limit.retryAfterSeconds) },
    );
  }

  const input = await readJsonBody(request, MAX_BODY_BYTES);
  if (!input.ok) {
    return fail(400, { code: "invalid-request", message: "The request body is not valid JSON." });
  }

  const parsed = parseRotationRequest(input.value);
  if (!parsed.ok) {
    return fail(400, {
      code: "invalid-request",
      message: "The rotations are not valid.",
      issues: parsed.issues,
    });
  }

  const body: ApiResponse<RotationComparisonResult> = {
    success: true,
    data: buildRotationComparison(parsed.request),
    error: null,
  };
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}
