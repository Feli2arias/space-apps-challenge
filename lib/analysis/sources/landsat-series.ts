import type { DateRange, VegetationMonth, VegetationObservation } from "../types";
import type { NdviStats } from "./landsat-ndvi";
import type { LandsatScene } from "./landsat-stac";

/**
 * From per-scene statistics to a history: which observations count, how two
 * scenes of the same satellite pass are handled, and the monthly summary.
 */

/**
 * Share of the area that must be seen clearly for a scene to count. A project
 * convention: with at least three quarters of the plot visible the mean
 * describes the plot rather than one corner of it. Over two years near Los
 * Chiles the choice matters little: of 258 scenes, 200 had no clear pixel, 41
 * were fully clear and only 17 fell in between (44 pass at 0.75, 49 at 0.5).
 */
export const MIN_CLEAR_FRACTION = 0.75;

/**
 * NDVI below this is reported as "compatible with little or no vegetation".
 * A convention, not a measurement: it is the lower end of the range USGS gives
 * for sparse vegetation ("approximately 0.2 to 0.5"), with bare rock, sand or
 * snow "0.1 or less"
 * (https://www.usgs.gov/special-topics/remote-sensing-phenology/science/ndvi-foundation-remote-sensing-phenology).
 */
export const LOW_VEGETATION_NDVI = 0.2;

/**
 * Decimals kept for NDVI. One stored step of reflectance is 0.0000275, so
 * anything beyond the fourth decimal is arithmetic noise, not information.
 */
const NDVI_DECIMALS = 4;

const MONTHS_PER_YEAR = 12;

function roundNdvi(value: number | null): number | null {
  if (value === null) return null;
  const factor = 10 ** NDVI_DECIMALS;
  return Math.round(value * factor) / factor;
}

/** True when enough of the area was clear for the scene's NDVI to count. */
export function isUsable(clearPixels: number, totalPixels: number): boolean {
  return totalPixels > 0 && clearPixels / totalPixels >= MIN_CLEAR_FRACTION;
}

type ObservedScene = Pick<LandsatScene, "id" | "date" | "platform" | "cloudCover">;

export function toObservation(
  scene: ObservedScene,
  stats: NdviStats,
  totalPixels: number,
): VegetationObservation {
  return {
    date: scene.date,
    sceneId: scene.id,
    platform: scene.platform,
    ndviMean: roundNdvi(stats.mean),
    ndviMin: roundNdvi(stats.min),
    ndviMax: roundNdvi(stats.max),
    clearPixels: stats.clearPixels,
    totalPixels,
    sceneCloudCover: scene.cloudCover,
    usable: isUsable(stats.clearPixels, totalPixels),
  };
}

const clearFraction = (observation: VegetationObservation): number =>
  observation.totalPixels > 0 ? observation.clearPixels / observation.totalPixels : 0;

/** Negative when `a` should be kept over `b`: clearer first, then a fixed order by scene id. */
function byPreference(a: VegetationObservation, b: VegetationObservation): number {
  return clearFraction(b) - clearFraction(a) || a.sceneId.localeCompare(b.sceneId);
}

export interface OnePerDate {
  /** One observation per acquisition date, oldest first. */
  readonly kept: readonly VegetationObservation[];
  /** Scenes left out because another scene of the same date was kept. */
  readonly setAside: number;
}

/**
 * Keeps one scene per date.
 *
 * Where two rows of the same orbit overlap, one satellite pass is delivered as
 * two scenes taken seconds apart. They are the same look at the plot, so
 * counting both would count that day twice. The scene where more of the area
 * is clear is kept; on a tie the lower scene id wins, so that the same row is
 * preferred every time (measured near Los Chiles, two clear scenes of one pass
 * differ by about 0.01 to 0.02 NDVI because each is corrected separately).
 */
export function keepOnePerDate(observations: readonly VegetationObservation[]): OnePerDate {
  const best = new Map<string, VegetationObservation>();
  for (const observation of observations) {
    const current = best.get(observation.date);
    if (!current || byPreference(observation, current) < 0) best.set(observation.date, observation);
  }
  const kept = [...best.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { kept, setAside: observations.length - kept.length };
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** NDVI means of the observations that count. */
export function usableMeans(observations: readonly VegetationObservation[]): readonly number[] {
  return observations.flatMap((observation) =>
    observation.usable && observation.ndviMean !== null ? [observation.ndviMean] : [],
  );
}

export function meanNdvi(observations: readonly VegetationObservation[]): number | null {
  return roundNdvi(mean(usableMeans(observations)));
}

/** Every calendar month touched by the period, in order, as [year, month 1–12]. */
function monthsOf(period: DateRange): readonly (readonly [number, number])[] {
  const [startYear, startMonth] = period.start.split("-").map(Number);
  const [endYear, endMonth] = period.end.split("-").map(Number);
  const count = (endYear - startYear) * MONTHS_PER_YEAR + (endMonth - startMonth) + 1;
  return Array.from({ length: Math.max(count, 0) }, (_, index) => {
    const monthIndex = startMonth - 1 + index;
    return [startYear + Math.floor(monthIndex / MONTHS_PER_YEAR), (monthIndex % MONTHS_PER_YEAR) + 1] as const;
  });
}

/**
 * One entry per calendar month of the period, including months with no
 * observation at all, so a gap shows as a gap instead of disappearing.
 */
export function aggregateMonthly(
  observations: readonly VegetationObservation[],
  period: DateRange,
): readonly VegetationMonth[] {
  return monthsOf(period).map(([year, month]) => {
    const prefix = `${year}-${String(month).padStart(2, "0")}-`;
    const inMonth = observations.filter((observation) => observation.date.startsWith(prefix));
    const means = usableMeans(inMonth);
    return {
      year,
      month,
      ndviMean: roundNdvi(mean(means)),
      usableObservations: means.length,
      totalObservations: inMonth.length,
    };
  });
}

function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export interface CappedPeriod {
  readonly period: DateRange;
  /** True when the requested period was longer and its older part was left out. */
  readonly capped: boolean;
}

/** The most recent `maxMonths` of a period, or the whole period when it is shorter. */
export function capPeriod(period: DateRange, maxMonths: number): CappedPeriod {
  const [endYear, endMonth, endDay] = period.end.split("-").map(Number);
  // The day after the end, moved back `maxMonths`, is the first day allowed.
  const dayAfter = new Date(Date.UTC(endYear, endMonth - 1, endDay + 1));
  const monthIndex = dayAfter.getUTCFullYear() * MONTHS_PER_YEAR + dayAfter.getUTCMonth() - maxMonths;
  const year = Math.floor(monthIndex / MONTHS_PER_YEAR);
  const month = (monthIndex % MONTHS_PER_YEAR) + 1;
  const day = Math.min(dayAfter.getUTCDate(), daysInMonth(year, month));
  const earliest = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const capped = earliest > period.start;
  return { period: capped ? { start: earliest, end: period.end } : period, capped };
}
