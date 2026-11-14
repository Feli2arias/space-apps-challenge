import { isAbortError, SourceError } from "../errors";
import { mapWithConcurrency } from "../http";
import type {
  AnalysisArea,
  AnalysisSource,
  DataScope,
  DateRange,
  ProductInfo,
  SourcePayload,
  SourceRunInput,
  VegetationData,
  VegetationObservation,
} from "../types";
import { VEGETATION_CONVERSION, VEGETATION_STAGE } from "./landsat-codes";
import { computeNdviStats, NO_CLEAR_PIXELS } from "./landsat-ndvi";
import { readSceneWindow } from "./landsat-pixels";
import { buildRejectMask } from "./landsat-qa";
import {
  aggregateMonthly,
  capPeriod,
  keepOnePerDate,
  LOW_VEGETATION_NDVI,
  MIN_CLEAR_FRACTION,
  toObservation,
} from "./landsat-series";
import { searchLandsatScenes } from "./landsat-stac";
import type { LandsatScene } from "./landsat-stac";
import { buildLimitations, buildMetrics, buildQuality } from "./landsat-summary";
import type { SceneCounts } from "./landsat-summary";
import { MIN_PIXELS_FOR_PARCEL, planSceneWindow } from "./landsat-window";

/**
 * Vegetation history of the analysed area: NDVI from Landsat 8/9 Collection 2
 * Level-2 surface reflectance, scene by scene, counting only the pixels of the
 * area that the quality band reports as clear.
 */

/**
 * How far back this source reads, whatever period is requested. Near Los
 * Chiles three path/rows overlap, which gives about 130 scenes a year.
 * Measured for 36 months: 386 scenes found, 320 read, 23 to 25 s in total.
 * Ten years would be over 1,000 reads. The three-year option of the app is
 * covered in full; longer requests get their most recent 36 months.
 */
export const MAX_HISTORY_MONTHS = 36;

/**
 * Scenes read at once. Measured against the Planetary Computer data API with
 * 258 scenes: 8 at once took 17.5 s and 16 at once 7.8 s, both without a
 * single error or "too many requests" answer. 8 is the lower of the two
 * levels tested, to stay polite with a free public service.
 */
const SCENE_CONCURRENCY = 8;

/**
 * No new scene is started once the source has been running this long. The
 * whole analysis has about 240 s and this source should stay well under 90 s.
 * Worst case: scenes already in flight at that moment may still take two
 * attempts of 10 s each, so the source ends by about 81 s. Scenes are read
 * newest first, so what is left out is the oldest part of the history.
 */
const RUN_BUDGET_MS = 60_000;

/** Only Tier 1 scenes are used; see the "tier-2-scenes-not-used" limitation. */
const USED_TIER = "T1";

const SQUARE_METERS_PER_HECTARE = 10_000;

const PRODUCT: ProductInfo = {
  id: "landsat-c2-l2",
  name: "Landsat 8-9 OLI/TIRS Collection 2 Level-2 Surface Reflectance",
  version: "Collection 2",
  provider: "USGS and NASA (Landsat)",
  accessedVia: "Microsoft Planetary Computer (STAC API and data API)",
  documentationUrl: "https://www.usgs.gov/landsat-missions/landsat-collection-2-level-2-science-products",
  spatialResolutionMeters: 30,
  temporalResolution: "per-scene",
};

type SceneOutcome =
  | { readonly kind: "examined"; readonly observation: VegetationObservation }
  | { readonly kind: "failed"; readonly error: SourceError }
  | { readonly kind: "not-read" };

/** Reads one scene and computes the NDVI statistics of the area in it. */
async function examineScene(
  scene: LandsatScene,
  area: AnalysisArea,
  signal: AbortSignal,
): Promise<VegetationObservation> {
  const planned = planSceneWindow(area, scene);
  if (!planned.ok) {
    throw new SourceError("unexpected", `Scene ${scene.id} cannot be read: ${planned.reason}.`, {
      retryable: false,
    });
  }
  const rejectMask = buildRejectMask(scene.qaBitfields);
  if (rejectMask === null) {
    throw new SourceError("bad-response", `Scene ${scene.id} does not describe its quality bits.`);
  }
  const { window, inside, totalPixels } = planned.plan;
  // The area lies outside this scene's raster: nothing to read, nothing clear.
  if (!window) return toObservation(scene, NO_CLEAR_PIXELS, totalPixels);

  const pixels = await readSceneWindow(scene, window, signal);
  const stats = computeNdviStats({ pixels, inside, red: scene.red, nir: scene.nir, rejectMask });
  return toObservation(scene, stats, totalPixels);
}

/** A scene that fails, for whatever reason, is reported, not fatal. A cancelled analysis stops everything. */
async function examineSafely(
  scene: LandsatScene,
  area: AnalysisArea,
  signal: AbortSignal,
): Promise<SceneOutcome> {
  try {
    return { kind: "examined", observation: await examineScene(scene, area, signal) };
  } catch (error) {
    const isCancelled =
      signal.aborted || isAbortError(error) || (error instanceof SourceError && error.code === "aborted");
    if (isCancelled) throw error;
    if (error instanceof SourceError) return { kind: "failed", error };
    const detail = error instanceof Error ? error.message : "unknown error";
    const wrapped = new SourceError("unexpected", `Scene ${scene.id} could not be processed: ${detail}`, {
      cause: error,
    });
    return { kind: "failed", error: wrapped };
  }
}

async function examineAll(
  scenes: readonly LandsatScene[],
  input: SourceRunInput,
  deadline: number,
): Promise<readonly SceneOutcome[]> {
  let completed = 0;
  input.reportProgress({ stage: VEGETATION_STAGE.readingScenes, completed, total: scenes.length });

  return mapWithConcurrency(
    scenes,
    SCENE_CONCURRENCY,
    async (scene): Promise<SceneOutcome> => {
      if (Date.now() > deadline) return { kind: "not-read" };
      const outcome = await examineSafely(scene, input.area, input.signal);
      completed += 1;
      input.reportProgress({ stage: VEGETATION_STAGE.readingScenes, completed, total: scenes.length });
      return outcome;
    },
    input.signal,
  );
}

/** The most common number of area pixels among the observations (grids differ between UTM zones). */
function typicalPixelCount(observations: readonly VegetationObservation[]): number {
  const frequency = new Map<number, number>();
  for (const { totalPixels } of observations) {
    frequency.set(totalPixels, (frequency.get(totalPixels) ?? 0) + 1);
  }
  let best = 0;
  let bestCount = 0;
  for (const [pixels, count] of frequency) {
    if (count > bestCount || (count === bestCount && pixels > best)) {
      best = pixels;
      bestCount = count;
    }
  }
  return best;
}

/** "parcel" when at least two Landsat pixels fall inside the area, "pixel" otherwise. */
function scopeOf(pixelsInArea: number, area: AnalysisArea, pixelSizeMeters: number): DataScope {
  // With no scene read there is no grid to count on: fall back to the area's size.
  const pixels =
    pixelsInArea > 0
      ? pixelsInArea
      : (area.areaHectares * SQUARE_METERS_PER_HECTARE) / pixelSizeMeters ** 2;
  return pixels >= MIN_PIXELS_FOR_PARCEL ? "parcel" : "pixel";
}

function throwIfNothingRead(outcomes: readonly SceneOutcome[]): void {
  const firstFailure = outcomes.find((outcome) => outcome.kind === "failed");
  const anyExamined = outcomes.some((outcome) => outcome.kind === "examined");
  if (anyExamined || outcomes.length === 0) return;
  if (firstFailure?.kind === "failed") {
    throw new SourceError(
      firstFailure.error.code,
      `None of the ${outcomes.length} Landsat scenes could be read. First problem: ${firstFailure.error.message}`,
      { retryable: firstFailure.error.retryable, cause: firstFailure.error },
    );
  }
  throw new SourceError("timeout", "No Landsat scene could be read in the time allowed.");
}

interface Assembly {
  readonly area: AnalysisArea;
  readonly period: DateRange;
  readonly periodCapped: boolean;
  readonly found: number;
  readonly unreadableItems: number;
  readonly tier1: readonly LandsatScene[];
  readonly outcomes: readonly SceneOutcome[];
}

function assemble(parts: Assembly): SourcePayload<VegetationData> {
  const { outcomes, tier1 } = parts;
  const examined = outcomes.flatMap((outcome) => (outcome.kind === "examined" ? [outcome.observation] : []));
  const { kept: observations, setAside } = keepOnePerDate(examined);
  const monthly = aggregateMonthly(observations, parts.period);
  const pixelsInArea = typicalPixelCount(observations);
  const scope = scopeOf(pixelsInArea, parts.area, PRODUCT.spatialResolutionMeters);
  const counts: SceneCounts = {
    found: parts.found,
    examined: examined.length,
    notTier1: parts.found - parts.unreadableItems - tier1.length,
    failed: parts.unreadableItems + outcomes.filter((outcome) => outcome.kind === "failed").length,
    notReadInTime: outcomes.filter((outcome) => outcome.kind === "not-read").length,
    sameDate: setAside,
    passes: new Set(tier1.map((scene) => scene.date)).size,
  };
  const quality = buildQuality(observations, monthly, counts);

  return {
    status: quality.valid !== null && quality.valid > 0 ? "ok" : "no-data",
    scope,
    period: parts.period,
    metrics: buildMetrics(observations, monthly, counts),
    data: {
      observations,
      monthly,
      lowVegetationThreshold: LOW_VEGETATION_NDVI,
      minClearFraction: MIN_CLEAR_FRACTION,
      pixelsInArea,
    },
    quality,
    limitations: buildLimitations({ scope, pixelsInArea, periodCapped: parts.periodCapped, counts }),
    conversions: [VEGETATION_CONVERSION.reflectanceScaling],
    // Scenes that failed or ran out of time may be readable on the next try.
    incomplete: counts.failed > 0 || counts.notReadInTime > 0,
  };
}

async function run(input: SourceRunInput): Promise<SourcePayload<VegetationData>> {
  const deadline = Date.now() + RUN_BUDGET_MS;
  const { period, capped } = capPeriod(input.period, MAX_HISTORY_MONTHS);

  input.reportProgress({ stage: VEGETATION_STAGE.searching });
  const search = await searchLandsatScenes(input.area.polygon, period, input.signal);
  const tier1 = search.scenes.filter((scene) => scene.tier === USED_TIER);

  const outcomes = await examineAll(tier1, input, deadline);
  throwIfNothingRead(outcomes);

  return assemble({
    area: input.area,
    period,
    periodCapped: capped,
    found: search.scenes.length + search.unreadableItems,
    unreadableItems: search.unreadableItems,
    tier1,
    outcomes,
  });
}

export const vegetationSource: AnalysisSource<"vegetation"> = {
  id: "vegetation",
  product: PRODUCT,
  cacheVersion: 2,
  isStatic: false,
  // Past scenes do not change day to day; a week keeps repeat visits fast.
  cacheTtlSeconds: 7 * 24 * 60 * 60,
  run,
};
