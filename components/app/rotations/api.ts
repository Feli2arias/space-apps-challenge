import type { RotationComparisonResult } from "@/lib/rotation/compare";
import type { RotationRequest } from "@/lib/rotation/schema";

/** Calls POST /api/rotations and checks the shape of what comes back. */

export const ROTATIONS_ENDPOINT = "/api/rotations";

export type ComparisonFailure = "rate-limited" | "invalid" | "network" | "aborted";

export type ComparisonOutcome =
  | { readonly ok: true; readonly result: RotationComparisonResult }
  | { readonly ok: false; readonly failure: ComparisonFailure };

const HTTP_TOO_MANY = 429;
const HTTP_BAD_REQUEST = 400;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Only the fields the interface reads are checked; the server builds the rest from tested code. */
export function parseComparison(body: unknown): RotationComparisonResult | null {
  if (!isRecord(body) || body.success !== true || !isRecord(body.data)) return null;
  const data = body.data;
  if (typeof data.baselineId !== "string" || !Array.isArray(data.readings) || !isRecord(data.study)) return null;
  const readingsOk = data.readings.every(
    (reading: unknown) =>
      isRecord(reading) &&
      typeof reading.planId === "string" &&
      typeof reading.previousCrop === "string" &&
      Array.isArray(reading.evidence),
  );
  return readingsOk ? (data as unknown as RotationComparisonResult) : null;
}

export async function postRotations(
  request: RotationRequest,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<ComparisonOutcome> {
  try {
    const response = await fetcher(ROTATIONS_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
    if (response.status === HTTP_TOO_MANY) return { ok: false, failure: "rate-limited" };
    if (response.status === HTTP_BAD_REQUEST) return { ok: false, failure: "invalid" };
    const result = parseComparison(await response.json());
    return result ? { ok: true, result } : { ok: false, failure: "network" };
  } catch {
    return { ok: false, failure: signal.aborted ? "aborted" : "network" };
  }
}
