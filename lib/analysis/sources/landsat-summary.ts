import type { DataScope, Metric, Quality, VegetationMonth, VegetationObservation } from "../types";
import {
  VEGETATION_LIMITATION,
  VEGETATION_METRIC,
  VEGETATION_QUALITY_NOTE,
} from "./landsat-codes";
import type { VegetationLimitation, VegetationQualityNote } from "./landsat-codes";
import { LOW_VEGETATION_NDVI, meanNdvi } from "./landsat-series";

/**
 * Turns the list of observations and the scene counts into the metrics, the
 * quality block and the limitation codes of the result. Pure functions only.
 */

/**
 * Below nine pixels (a 3 × 3 block, about 0.8 ha) no pixel can lie fully
 * inside the plot: every one touches the edge and mixes in what is next to it.
 */
export const MIN_PIXELS_WITH_INTERIOR = 9;

const PERCENT = 100;

/** Where every scene the search returned ended up. */
export interface SceneCounts {
  /** Scenes returned by the search. */
  readonly found: number;
  /** Scenes read and evaluated, including those set aside as same-date. */
  readonly examined: number;
  /** Scenes not used because they are not Tier 1. */
  readonly notTier1: number;
  /** Scenes whose metadata or pixels could not be read. */
  readonly failed: number;
  /** Scenes left unread because the time allowed for this source ran out. */
  readonly notReadInTime: number;
  /** Scenes read but left out because another scene of the same date was kept. */
  readonly sameDate: number;
  /** Distinct acquisition dates among the Tier 1 scenes: the passes that could have counted. */
  readonly passes: number;
}

interface DatedValue {
  readonly value: number;
  readonly date: string;
}

function usableValues(observations: readonly VegetationObservation[]): readonly DatedValue[] {
  return observations.flatMap((observation) =>
    observation.usable && observation.ndviMean !== null
      ? [{ value: observation.ndviMean, date: observation.date }]
      : [],
  );
}

function extreme(values: readonly DatedValue[], pick: (a: number, b: number) => boolean): DatedValue | null {
  return values.reduce<DatedValue | null>(
    (best, current) => (best === null || pick(current.value, best.value) ? current : best),
    null,
  );
}

function ndviMetric(id: string, aggregation: Metric["aggregation"], dated: DatedValue | null): Metric {
  return dated
    ? { id, value: dated.value, unit: "index", aggregation, at: { date: dated.date } }
    : { id, value: null, unit: "index", aggregation };
}

const countMetric = (id: string, value: number): Metric => ({ id, value, unit: "count", aggregation: "count" });

export function monthsWithoutObservation(monthly: readonly VegetationMonth[]): number {
  return monthly.filter((month) => month.usableObservations === 0).length;
}

/** Percentage of the usable dates whose plot NDVI is under the low-vegetation threshold. */
function lowVegetationPercent(values: readonly DatedValue[]): number | null {
  if (values.length === 0) return null;
  const low = values.filter((entry) => entry.value < LOW_VEGETATION_NDVI).length;
  return (low / values.length) * PERCENT;
}

export function buildMetrics(
  observations: readonly VegetationObservation[],
  monthly: readonly VegetationMonth[],
  counts: SceneCounts,
): readonly Metric[] {
  const values = usableValues(observations);
  // Observations are ordered oldest first, so the last usable one is the latest.
  const latest = values.length > 0 ? values[values.length - 1] : null;
  return [
    { id: VEGETATION_METRIC.ndviMean, value: meanNdvi(observations), unit: "index", aggregation: "mean" },
    ndviMetric(VEGETATION_METRIC.ndviMin, "min", extreme(values, (a, b) => a < b)),
    ndviMetric(VEGETATION_METRIC.ndviMax, "max", extreme(values, (a, b) => a > b)),
    ndviMetric(VEGETATION_METRIC.ndviLatest, "value", latest),
    countMetric(VEGETATION_METRIC.usableObservations, values.length),
    {
      id: VEGETATION_METRIC.monthsWithoutObservation,
      value: monthsWithoutObservation(monthly),
      unit: "count",
      aggregation: "count",
    },
    {
      id: VEGETATION_METRIC.lowVegetationShare,
      value: lowVegetationPercent(values),
      unit: "percent",
      aggregation: "share",
    },
    countMetric(VEGETATION_METRIC.scenesFound, counts.found),
    countMetric(VEGETATION_METRIC.scenesExamined, counts.examined),
    countMetric(VEGETATION_METRIC.scenesNotTier1, counts.notTier1),
    countMetric(VEGETATION_METRIC.scenesNotRead, counts.failed + counts.notReadInTime),
    countMetric(VEGETATION_METRIC.scenesSameDate, counts.sameDate),
  ];
}

/**
 * Expected = satellite passes over the area in the period (Tier 1 dates);
 * valid = passes where the plot was seen clearly enough to count.
 */
export function buildQuality(
  observations: readonly VegetationObservation[],
  monthly: readonly VegetationMonth[],
  counts: SceneCounts,
): Quality {
  const valid = usableValues(observations).length;
  const notes: VegetationQualityNote[] = [];
  if (monthsWithoutObservation(monthly) > 0) notes.push(VEGETATION_QUALITY_NOTE.monthsWithoutObservation);
  if (counts.failed > 0) notes.push(VEGETATION_QUALITY_NOTE.scenesNotRead);
  if (counts.notReadInTime > 0) notes.push(VEGETATION_QUALITY_NOTE.timeBudgetReached);
  return {
    expected: counts.passes,
    valid,
    coverage: counts.passes > 0 ? valid / counts.passes : null,
    notes,
  };
}

export interface LimitationInputs {
  readonly scope: DataScope;
  readonly pixelsInArea: number;
  readonly periodCapped: boolean;
  readonly counts: SceneCounts;
}

export function buildLimitations(inputs: LimitationInputs): readonly VegetationLimitation[] {
  const { scope, pixelsInArea, periodCapped, counts } = inputs;
  const isSmallParcel = scope === "parcel" && pixelsInArea < MIN_PIXELS_WITH_INTERIOR;
  const conditional: readonly (readonly [boolean, VegetationLimitation])[] = [
    [periodCapped, VEGETATION_LIMITATION.periodCapped],
    [scope === "pixel", VEGETATION_LIMITATION.singlePixel],
    [isSmallParcel, VEGETATION_LIMITATION.edgePixelsMixed],
    [counts.notTier1 > 0, VEGETATION_LIMITATION.tier2NotUsed],
    [counts.sameDate > 0, VEGETATION_LIMITATION.sameDateCountedOnce],
  ];
  return [
    VEGETATION_LIMITATION.notADiagnosis,
    VEGETATION_LIMITATION.thresholdIsConvention,
    VEGETATION_LIMITATION.cloudMaskCanMiss,
    VEGETATION_LIMITATION.meanFavoursClearMonths,
    ...conditional.filter(([applies]) => applies).map(([, code]) => code),
  ];
}
