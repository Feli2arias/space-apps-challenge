/**
 * Pure helpers that turn an `Analysis` into what the results panel draws.
 *
 * Nothing here invents a value: a missing number stays `null`, a month with no
 * observation stays a gap, and nothing is interpolated or averaged again.
 */

import type {
  Analysis,
  DateRange,
  Metric,
  RainClimatologyMonth,
  SourceId,
  SourceResult,
  VegetationMonth,
  VegetationObservation,
} from "@/lib/analysis/types";
import { SOURCE_IDS } from "@/lib/analysis/types";

const MONTHS_IN_YEAR = 12;

/**
 * Difference in metres between the climate product's grid cell and the terrain
 * of the analysed area from which the panel warns that the regional temperature
 * belongs to another altitude. In the ICAO Standard Atmosphere air cools about
 * 6.5 °C per 1000 m, so 150 m is roughly 1 °C: the smallest gap worth a note.
 * The panel only states the difference; it never corrects the temperature.
 */
export const ELEVATION_MISMATCH_THRESHOLD_METERS = 150;

/** A cap on the years drawn in the vegetation timeline, to guard against a bad period. */
const MAX_TIMELINE_YEARS = 30;

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clampShare(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/* ------------------------------------------------------------------ */
/* Which sources answered                                             */
/* ------------------------------------------------------------------ */

export interface SourceSummary {
  readonly withData: readonly SourceId[];
  readonly noData: readonly SourceId[];
  readonly failed: readonly SourceId[];
}

/** Sorts the five sources by what they returned, keeping the display order. */
export function summariseSources(analysis: Analysis): SourceSummary {
  const statusOf = (id: SourceId) => analysis.sources?.[id]?.status;
  return {
    withData: SOURCE_IDS.filter((id) => statusOf(id) === "ok"),
    noData: SOURCE_IDS.filter((id) => statusOf(id) === "no-data"),
    // A source that is absent from the response is reported as failed, not hidden.
    failed: SOURCE_IDS.filter((id) => statusOf(id) !== "ok" && statusOf(id) !== "no-data"),
  };
}

/* ------------------------------------------------------------------ */
/* Rain                                                               */
/* ------------------------------------------------------------------ */

export interface RainChartRow {
  /** 1 to 12. */
  readonly month: number;
  readonly meanMm: number | null;
  readonly minMm: number | null;
  readonly maxMm: number | null;
  readonly years: number | null;
  /** Bar length from 0 to 1. `null` when the mean is missing. */
  readonly meanShare: number | null;
  /** Ends of the min–max line from 0 to 1. `null` unless both exist. */
  readonly rangeShare: { readonly from: number; readonly to: number } | null;
}

export interface RainChart {
  /** Always 12 rows, January first. */
  readonly rows: readonly RainChartRow[];
  /** Largest value drawn, in mm. `null` when every month is missing. */
  readonly scaleMaxMm: number | null;
  /** True when at least one month has a mean. */
  readonly hasValues: boolean;
}

/**
 * Lays out the monthly rain chart. Every bar shares one scale, set by the
 * largest value present (a month's maximum when there is one, else its mean).
 * Months absent from the input are kept as rows with missing values.
 */
export function buildRainChart(climatology: readonly RainClimatologyMonth[] | null | undefined): RainChart {
  const byMonth = new Map((climatology ?? []).map((entry) => [entry.month, entry]));
  const drawn = (climatology ?? []).flatMap((entry) =>
    [entry.meanMm, entry.maxMm].filter(isNumber),
  );
  const scaleMaxMm = drawn.length > 0 ? Math.max(...drawn) : null;
  // A scale of zero (a place where it never rains) would divide by zero: bars stay empty.
  const share = (value: number) =>
    scaleMaxMm !== null && scaleMaxMm > 0 ? clampShare(value / scaleMaxMm) : 0;

  const rows = Array.from({ length: MONTHS_IN_YEAR }, (_, index): RainChartRow => {
    const month = index + 1;
    const entry = byMonth.get(month);
    const meanMm = isNumber(entry?.meanMm) ? entry.meanMm : null;
    const minMm = isNumber(entry?.minMm) ? entry.minMm : null;
    const maxMm = isNumber(entry?.maxMm) ? entry.maxMm : null;
    return {
      month,
      meanMm,
      minMm,
      maxMm,
      years: isNumber(entry?.years) ? entry.years : null,
      meanShare: meanMm === null ? null : share(meanMm),
      rangeShare:
        minMm === null || maxMm === null ? null : { from: share(minMm), to: share(maxMm) },
    };
  });

  return { rows, scaleMaxMm, hasValues: rows.some((row) => row.meanMm !== null) };
}

/* ------------------------------------------------------------------ */
/* Vegetation                                                         */
/* ------------------------------------------------------------------ */

/**
 * - "usable": at least one usable scene, so the month has an NDVI.
 * - "unusable": scenes existed but none was clear enough.
 * - "none": no scene at all that month.
 * - "outside": the month is not part of the analysed period.
 */
export type TimelineCellState = "usable" | "unusable" | "none" | "outside";

export interface TimelineCell {
  readonly year: number;
  /** 1 to 12. */
  readonly month: number;
  readonly state: TimelineCellState;
  readonly ndviMean: number | null;
  readonly usableObservations: number;
  readonly totalObservations: number;
  /** Column height from 0 to 1 (NDVI clamped to that range). `null` unless usable. */
  readonly heightShare: number | null;
}

export interface TimelineYear {
  readonly year: number;
  /** Always 12 cells, January first. */
  readonly cells: readonly TimelineCell[];
}

export interface VegetationTimeline {
  readonly years: readonly TimelineYear[];
  /** Months inside the period. */
  readonly monthsInPeriod: number;
  readonly usableMonths: number;
}

interface YearMonth {
  readonly year: number;
  readonly month: number;
}

const YEAR_MONTH_PATTERN = /^(\d{4})-(\d{2})/;

function parseYearMonth(isoDate: string | undefined): YearMonth | null {
  const match = YEAR_MONTH_PATTERN.exec(isoDate ?? "");
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= MONTHS_IN_YEAR ? { year: Number(match[1]), month } : null;
}

/** Months since year zero: lets two year-month pairs be compared as one number. */
function monthIndex(value: YearMonth): number {
  return value.year * MONTHS_IN_YEAR + (value.month - 1);
}

/** The span to draw: the stated period, or else the span of the months that came back. */
function timelineSpan(
  monthly: readonly VegetationMonth[],
  period: DateRange | null | undefined,
): { readonly first: number; readonly last: number } | null {
  const start = parseYearMonth(period?.start);
  const end = parseYearMonth(period?.end);
  if (start && end && monthIndex(start) <= monthIndex(end)) {
    return { first: monthIndex(start), last: monthIndex(end) };
  }
  if (monthly.length === 0) return null;
  const indexes = monthly.map(monthIndex);
  return { first: Math.min(...indexes), last: Math.max(...indexes) };
}

function cellFor(year: number, month: number, entry: VegetationMonth | undefined, inside: boolean): TimelineCell {
  const base = { year, month, usableObservations: 0, totalObservations: 0 };
  if (!inside) return { ...base, state: "outside", ndviMean: null, heightShare: null };
  if (!entry || !(entry.totalObservations > 0)) {
    return { ...base, state: "none", ndviMean: null, heightShare: null };
  }
  const counts = {
    usableObservations: entry.usableObservations,
    totalObservations: entry.totalObservations,
  };
  if (!isNumber(entry.ndviMean)) {
    return { year, month, ...counts, state: "unusable", ndviMean: null, heightShare: null };
  }
  return {
    year,
    month,
    ...counts,
    state: "usable",
    ndviMean: entry.ndviMean,
    heightShare: clampShare(entry.ndviMean),
  };
}

/**
 * Lays the monthly NDVI out as one row per calendar year. Months with no entry
 * become gaps; they are never filled from their neighbours.
 */
export function buildVegetationTimeline(
  monthly: readonly VegetationMonth[] | null | undefined,
  period: DateRange | null | undefined,
): VegetationTimeline {
  const entries = (monthly ?? []).filter(
    (entry) => Number.isInteger(entry.year) && entry.month >= 1 && entry.month <= MONTHS_IN_YEAR,
  );
  const span = timelineSpan(entries, period);
  if (span === null) return { years: [], monthsInPeriod: 0, usableMonths: 0 };

  const byIndex = new Map(entries.map((entry) => [monthIndex(entry), entry]));
  const firstYear = Math.floor(span.first / MONTHS_IN_YEAR);
  const lastYear = Math.min(Math.floor(span.last / MONTHS_IN_YEAR), firstYear + MAX_TIMELINE_YEARS - 1);

  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, offset): TimelineYear => {
    const year = firstYear + offset;
    const cells = Array.from({ length: MONTHS_IN_YEAR }, (_unused, monthOffset) => {
      const index = monthIndex({ year, month: monthOffset + 1 });
      const inside = index >= span.first && index <= span.last;
      return cellFor(year, monthOffset + 1, byIndex.get(index), inside);
    });
    return { year, cells };
  });

  const cells = years.flatMap((year) => year.cells);
  return {
    years,
    monthsInPeriod: cells.filter((cell) => cell.state !== "outside").length,
    usableMonths: cells.filter((cell) => cell.state === "usable").length,
  };
}

export interface SceneCounts {
  readonly total: number;
  readonly usable: number;
}

/** How many scenes were examined and how many of them counted. */
export function countScenes(
  observations: readonly VegetationObservation[] | null | undefined,
): SceneCounts {
  const scenes = observations ?? [];
  return { total: scenes.length, usable: scenes.filter((scene) => scene.usable === true).length };
}

/* ------------------------------------------------------------------ */
/* Terrain against climate                                            */
/* ------------------------------------------------------------------ */

/**
 * Finds the mean elevation of the analysed area among the terrain metrics:
 * a mean, in metres, whose id mentions elevation. If no id mentions it, the
 * only mean in metres is used; with several candidates nothing is guessed.
 */
export function findMeanElevation(metrics: readonly Metric[] | null | undefined): number | null {
  const meansInMeters = (metrics ?? []).filter(
    (metric) => metric.unit === "m" && metric.aggregation === "mean" && isNumber(metric.value),
  );
  const named = meansInMeters.filter((metric) => /elev|altit/i.test(metric.id));
  const candidates = named.length > 0 ? named : meansInMeters;
  return candidates.length === 1 ? candidates[0].value : null;
}

export interface ElevationMismatch {
  readonly terrainMeters: number;
  readonly gridCellMeters: number;
  /** Always positive. */
  readonly differenceMeters: number;
}

/**
 * Compares the altitude the climate product assumes with the terrain of the
 * area. Returns the mismatch only when both are known and they differ by more
 * than the threshold; `null` otherwise, including when either is missing.
 */
export function checkElevationMismatch(
  terrain: SourceResult<unknown> | null | undefined,
  climate: SourceResult<{ readonly gridCellElevationMeters: number | null }> | null | undefined,
  thresholdMeters: number = ELEVATION_MISMATCH_THRESHOLD_METERS,
): ElevationMismatch | null {
  if (terrain?.status !== "ok" || climate?.status !== "ok") return null;
  const terrainMeters = findMeanElevation(terrain.metrics);
  const gridCellMeters = climate.data?.gridCellElevationMeters;
  if (terrainMeters === null || !isNumber(gridCellMeters)) return null;
  const differenceMeters = Math.abs(terrainMeters - gridCellMeters);
  return differenceMeters > thresholdMeters
    ? { terrainMeters, gridCellMeters, differenceMeters }
    : null;
}

/* ------------------------------------------------------------------ */
/* Links                                                              */
/* ------------------------------------------------------------------ */

/**
 * Returns the address only when it is a well-formed http(s) URL. Product
 * metadata arrives from the API, so it is checked before it becomes a link:
 * anything else (an empty string, a `javascript:` address) is refused.
 */
export function toHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}
