import type { RainData, VegetationData } from "./types";

/**
 * Derived readings that combine two sources. They are calculations made by
 * this app, not values any service returns, and the interface labels them as
 * such together with the assumptions written here.
 */

/** A calendar month needs at least this many usable scenes before anything is said about it. */
export const MIN_OBSERVATIONS_PER_MONTH = 2;
/** A month counts as "mostly low vegetation" when at least this share of its scenes is below the threshold. */
export const LOW_VEGETATION_MAJORITY = 0.5;

export interface RainCoverMonth {
  /** 1 to 12. */
  readonly month: number;
  /** Mean rainfall of the calendar month, from the regional rainfall product. */
  readonly meanRainMm: number | null;
  /** Usable Landsat observations of the area in this calendar month, all years pooled. */
  readonly usableObservations: number;
  /** How many of those had a mean NDVI below the low-vegetation threshold. */
  readonly lowVegetationObservations: number;
  /** `null` when there are too few observations to say. */
  readonly lowVegetationShare: number | null;
  /** True when the month is rainier than the average month. `null` without rainfall data. */
  readonly rainierThanAverage: boolean | null;
  /**
   * True when a rainier-than-average month also shows mostly low vegetation.
   * `null` means it cannot be known, which is different from `false`.
   */
  readonly rainOnLowCover: boolean | null;
}

export interface RainCoverInsight {
  /** Always 12 entries, January first. */
  readonly months: readonly RainCoverMonth[];
  /** Months (1 to 12) where rain and low vegetation coincide. */
  readonly coincidingMonths: readonly number[];
  /** Months that could not be judged for lack of clear scenes or rainfall data. */
  readonly unknownMonths: readonly number[];
  /** Share of the mean annual rainfall that falls in the coinciding months (0 to 1). */
  readonly rainShareInCoincidingMonths: number | null;
  readonly lowVegetationThreshold: number;
  readonly minObservationsPerMonth: number;
  readonly lowVegetationMajority: number;
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

function monthOf(isoDate: string): number {
  return Number.parseInt(isoDate.slice(5, 7), 10);
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Looks, month by month, at whether the rainiest part of the year is also when
 * the area tends to show little vegetation. Rain is regional and vegetation is
 * read on the area itself, so this points at months worth a closer look; it is
 * not a measurement of erosion.
 */
export function rainCoverInsight(
  rain: RainData | null,
  vegetation: VegetationData | null,
): RainCoverInsight | null {
  if (!rain || !vegetation) return null;

  const rainByMonth = new Map(rain.climatology.map((entry) => [entry.month, entry.meanMm]));
  const knownRain = MONTHS.map((month) => rainByMonth.get(month) ?? null).filter(
    (value): value is number => value !== null,
  );
  const averageMonth = mean(knownRain);
  const annualRain = knownRain.length === 12 ? knownRain.reduce((sum, value) => sum + value, 0) : null;

  const usable = vegetation.observations.filter(
    (observation) => observation.usable && observation.ndviMean !== null,
  );

  const months: RainCoverMonth[] = MONTHS.map((month) => {
    const ofMonth = usable.filter((observation) => monthOf(observation.date) === month);
    const low = ofMonth.filter(
      (observation) => (observation.ndviMean ?? 0) < vegetation.lowVegetationThreshold,
    ).length;
    const enough = ofMonth.length >= MIN_OBSERVATIONS_PER_MONTH;
    const lowVegetationShare = enough ? low / ofMonth.length : null;
    const meanRainMm = rainByMonth.get(month) ?? null;
    const rainierThanAverage =
      meanRainMm === null || averageMonth === null ? null : meanRainMm > averageMonth;
    // A dry month is never a coincidence, even when vegetation is unknown.
    const rainOnLowCover =
      rainierThanAverage === false
        ? false
        : rainierThanAverage === null || lowVegetationShare === null
          ? null
          : lowVegetationShare >= LOW_VEGETATION_MAJORITY;

    return {
      month,
      meanRainMm,
      usableObservations: ofMonth.length,
      lowVegetationObservations: low,
      lowVegetationShare,
      rainierThanAverage,
      rainOnLowCover,
    };
  });

  const coincidingMonths = months.filter((entry) => entry.rainOnLowCover === true).map((entry) => entry.month);
  const unknownMonths = months.filter((entry) => entry.rainOnLowCover === null).map((entry) => entry.month);
  const rainInCoinciding = months
    .filter((entry) => entry.rainOnLowCover === true)
    .reduce((sum, entry) => sum + (entry.meanRainMm ?? 0), 0);

  return {
    months,
    coincidingMonths,
    unknownMonths,
    rainShareInCoincidingMonths:
      annualRain === null || annualRain === 0 ? null : rainInCoinciding / annualRain,
    lowVegetationThreshold: vegetation.lowVegetationThreshold,
    minObservationsPerMonth: MIN_OBSERVATIONS_PER_MONTH,
    lowVegetationMajority: LOW_VEGETATION_MAJORITY,
  };
}
