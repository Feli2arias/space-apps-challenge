import { z } from "zod";
import { SourceError } from "../errors";
import { requestJson } from "../http";
import type { AnalysisSource, Position, SourcePayload, SourceRunInput, TerrainData } from "../types";
import { pause } from "./pause";
import {
  MAX_LOCATIONS_PER_REQUEST,
  NATIVE_SPACING_METERS,
  planElevationGrid,
  summariseTerrain,
} from "./terrain.compute";

/**
 * Elevation and slope from SRTM, read through the Open Topo Data public API.
 *
 * Checked against https://www.opentopodata.org/api/ and with real calls
 * (2026-11-14): `GET /v1/srtm30m?locations=lat,lng|lat,lng` needs no key and
 * answers `{ results: [{ dataset, elevation, location }], status: "OK" }`,
 * in the order of the request. `elevation` is `null` where the dataset has
 * no tile (for example north of 60° N).
 */

const ENDPOINT = "https://api.opentopodata.org/v1/srtm30m";

/**
 * Open Topo Data public API: "Max 1 call per second" (opentopodata.org). The
 * extra 100 ms covers clock and network jitter between two calls.
 */
const MIN_INTERVAL_BETWEEN_CALLS_MS = 1_100;

/** A real call for 100 points answers in about half a second; 15 s means it hangs. */
const REQUEST_TIMEOUT_MS = 15_000;

/** Tries per batch, the first one included, for failures worth repeating. */
const MAX_ATTEMPTS_PER_BATCH = 3;

/** Wait after a 429 before trying again: two of the one-second windows of the limit. */
const WAIT_AFTER_RATE_LIMIT_MS = 2_000;

/**
 * Decimals sent for each coordinate. Six decimals of a degree are about 0.1 m,
 * far finer than a 30 m pixel, and keep 100 points well inside a URL.
 */
const COORDINATE_DECIMALS = 6;

/** SRTM does not change, so a result stays valid for a long time (30 days). */
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;

export const TERRAIN_STAGE = {
  requestingElevation: "requesting-elevation",
  computingSlope: "computing-slope",
} as const;

const responseSchema = z.object({
  status: z.literal("OK"),
  results: z.array(
    z.object({
      dataset: z.string(),
      elevation: z.number().nullable(),
      location: z.object({ lat: z.number(), lng: z.number() }),
    }),
  ),
});

/**
 * Validates one answer of the service and returns its elevations in metres,
 * in request order. `null` stays `null`: it means "no data here", not zero.
 */
export function parseElevationResponse(body: unknown, expectedCount: number): readonly (number | null)[] {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) {
    throw new SourceError("bad-response", "Open Topo Data answered in an unexpected format.", {
      cause: parsed.error,
    });
  }
  if (parsed.data.results.length !== expectedCount) {
    throw new SourceError(
      "bad-response",
      `Open Topo Data returned ${parsed.data.results.length} elevations for ${expectedCount} points.`,
    );
  }
  return parsed.data.results.map((result) => result.elevation);
}

/**
 * URL for one batch of points. `interpolation=bilinear` (the service default,
 * stated explicitly) blends the four surrounding pixels, the usual way to
 * read a raster at points that do not sit exactly on its pixel centres.
 */
export function buildElevationUrl(points: readonly Position[]): string {
  const locations = points
    .map(([lon, lat]) => `${lat.toFixed(COORDINATE_DECIMALS)},${lon.toFixed(COORDINATE_DECIMALS)}`)
    .join("|");
  return `${ENDPOINT}?locations=${locations}&interpolation=bilinear`;
}

export function chunk<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  const count = Math.ceil(items.length / size);
  return Array.from({ length: count }, (_, index) => items.slice(index * size, (index + 1) * size));
}

/**
 * Earliest moment the next call may start. It is shared by every analysis in
 * this server process, because the one-call-per-second limit applies to the
 * app as a whole and not to each visitor. (Several server instances would
 * each keep their own; then the 429 handling below is the safety net.)
 */
let nextCallAt = 0;

async function waitForTurn(signal: AbortSignal): Promise<void> {
  const now = Date.now();
  const startAt = Math.max(now, nextCallAt);
  nextCallAt = startAt + MIN_INTERVAL_BETWEEN_CALLS_MS;
  if (startAt > now) await pause(startAt - now, signal);
}

function explainRateLimit(error: SourceError): SourceError {
  if (error.code !== "rate-limited") return error;
  return new SourceError(
    "rate-limited",
    "Open Topo Data refused the request (status 429). Its public API allows 1 call per second and 1000 calls per day.",
    { status: error.status ?? undefined, retryable: true, cause: error },
  );
}

async function fetchBatch(points: readonly Position[], signal: AbortSignal): Promise<readonly (number | null)[]> {
  const url = buildElevationUrl(points);
  for (let attempt = 1; ; attempt += 1) {
    await waitForTurn(signal);
    try {
      // Retries are handled here, not in `requestJson`, so that each one waits its turn.
      const body = await requestJson(url, { timeoutMs: REQUEST_TIMEOUT_MS, retries: 0, signal });
      return parseElevationResponse(body, points.length);
    } catch (error) {
      if (!(error instanceof SourceError)) throw error;
      if (!error.retryable || attempt >= MAX_ATTEMPTS_PER_BATCH) throw explainRateLimit(error);
      if (error.code === "rate-limited") await pause(WAIT_AFTER_RATE_LIMIT_MS, signal);
    }
  }
}

async function run(input: SourceRunInput): Promise<SourcePayload<TerrainData>> {
  const plan = planElevationGrid(input.area.bbox);
  const batches = chunk(plan.points, MAX_LOCATIONS_PER_REQUEST);
  const stage = TERRAIN_STAGE.requestingElevation;
  input.reportProgress({ stage, completed: 0, total: batches.length });

  // One batch at a time: the service allows a single call per second.
  let elevations: readonly (number | null)[] = [];
  for (const [index, batch] of batches.entries()) {
    elevations = [...elevations, ...(await fetchBatch(batch, input.signal))];
    input.reportProgress({ stage, completed: index + 1, total: batches.length });
  }

  input.reportProgress({ stage: TERRAIN_STAGE.computingSlope });
  return summariseTerrain(plan, elevations, input.area);
}

export const terrainSource: AnalysisSource<"terrain"> = {
  id: "terrain",
  product: {
    id: "SRTMGL1",
    name: "NASA Shuttle Radar Topography Mission Global 1 arc second",
    // "The public API uses Version 3 of SRTM" (opentopodata.org/datasets/srtm).
    version: "003",
    provider: "NASA JPL (distributed by LP DAAC)",
    accessedVia: "Open Topo Data public API, dataset srtm30m",
    documentationUrl: "https://doi.org/10.5067/MEASURES/SRTM/SRTMGL1.003",
    spatialResolutionMeters: NATIVE_SPACING_METERS,
    temporalResolution: "static",
  },
  cacheVersion: 1,
  isStatic: true,
  cacheTtlSeconds: CACHE_TTL_SECONDS,
  run,
};
