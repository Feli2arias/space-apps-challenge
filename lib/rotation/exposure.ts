/**
 * Compares how exposed the soil is to rain under different rotations of the
 * same plot.
 *
 * This is a model, not a measurement. It combines two published ideas:
 *
 * 1. Rain that comes concentrated in a few months erodes more than the same
 *    rain spread out. Each month is weighted by its rainfall squared, the
 *    weighting behind the Modified Fournier Index (Arnoldus, 1980).
 * 2. Ground cover protects the soil exponentially: the soil-loss ratio is
 *    exp(-b × percent cover), the surface-cover relation used in RUSLE. The
 *    coefficient b ranges from about 0.025 where sheet erosion dominates to
 *    about 0.05 where rills dominate (USDA RUSLE2 documentation), so results
 *    are given for the typical value and for both ends of that range.
 *
 * Slope and soil type are the same for every rotation on one plot, so they
 * cancel out when rotations are compared with each other. That is why the
 * result is a ratio against the current practice and never a figure in tonnes.
 */

export const COVER_LEVELS = ["bare", "low", "medium", "high"] as const;
export type CoverLevel = (typeof COVER_LEVELS)[number];

/** Ground cover, in percent, that each declared level stands for. */
export const COVER_PERCENT: Readonly<Record<CoverLevel, number>> = {
  bare: 0,
  low: 30,
  medium: 60,
  high: 90,
};

/** Surface-cover coefficient b of RUSLE: typical value and the documented range. */
export const SURFACE_COVER_COEFFICIENT = {
  interrill: 0.025,
  typical: 0.035,
  rill: 0.05,
} as const;

const MONTHS_PER_YEAR = 12;

export interface RotationPlan {
  readonly id: string;
  /** Ground cover declared for each calendar month, January first. Always 12 entries. */
  readonly months: readonly CoverLevel[];
}

export interface RotationExposure {
  readonly planId: string;
  /** Rain-weighted soil-loss ratio from 0 (always covered) to 1 (always bare), typical b. */
  readonly index: number;
  /** The same index at both ends of the documented range of b. */
  readonly indexRange: { readonly low: number; readonly high: number };
  /** Index divided by the baseline's. 1 means "same as the current practice". */
  readonly relativeToBaseline: number | null;
  readonly relativeRange: { readonly low: number; readonly high: number } | null;
  /** Calendar months (1 to 12) declared as bare soil. */
  readonly bareMonths: readonly number[];
  /** Bare months that are also rainier than the average month. */
  readonly bareRainyMonths: readonly number[];
  /** Share of the year's rainfall that falls on months declared bare (0 to 1). */
  readonly rainShareOnBare: number;
}

export interface RotationComparison {
  readonly baselineId: string;
  /** Share of the year's erosive rain attributed to each month, January first. */
  readonly erosivityShares: readonly number[];
  readonly exposures: readonly RotationExposure[];
}

/** Share of soil lost with a given ground cover, compared with bare soil. */
export function soilLossRatio(coverPercent: number, coefficient: number): number {
  return Math.exp(-coefficient * coverPercent);
}

/**
 * Splits the year's erosive rain among the months, weighting each month by its
 * rainfall squared. Returns `null` when a month is missing or it never rains,
 * because then no honest split exists.
 */
export function erosivityShares(monthlyRainMm: readonly (number | null)[]): number[] | null {
  if (monthlyRainMm.length !== MONTHS_PER_YEAR) return null;
  if (monthlyRainMm.some((value) => value === null || !Number.isFinite(value) || value < 0)) return null;
  const squares = (monthlyRainMm as readonly number[]).map((value) => value * value);
  const total = squares.reduce((sum, value) => sum + value, 0);
  return total === 0 ? null : squares.map((value) => value / total);
}

function isValidPlan(plan: RotationPlan): boolean {
  return (
    plan.months.length === MONTHS_PER_YEAR &&
    plan.months.every((level) => (COVER_LEVELS as readonly string[]).includes(level))
  );
}

function weightedIndex(plan: RotationPlan, shares: readonly number[], coefficient: number): number {
  return plan.months.reduce(
    (sum, level, index) => sum + shares[index] * soilLossRatio(COVER_PERCENT[level], coefficient),
    0,
  );
}

function ratio(value: number, baseline: number): number | null {
  return baseline === 0 ? null : value / baseline;
}

/**
 * Compares rotation plans against the one named as baseline (the current
 * practice). Returns `null` when the rainfall is incomplete, a plan is
 * malformed or the baseline is not among the plans.
 */
export function compareRotations(
  plans: readonly RotationPlan[],
  baselineId: string,
  monthlyRainMm: readonly (number | null)[],
): RotationComparison | null {
  const shares = erosivityShares(monthlyRainMm);
  const baseline = plans.find((plan) => plan.id === baselineId);
  if (!shares || !baseline || !plans.every(isValidPlan)) return null;

  const rain = monthlyRainMm as readonly number[];
  const annualRain = rain.reduce((sum, value) => sum + value, 0);
  const averageMonth = annualRain / MONTHS_PER_YEAR;
  const { interrill, typical, rill } = SURFACE_COVER_COEFFICIENT;
  const baselineIndex = {
    typical: weightedIndex(baseline, shares, typical),
    interrill: weightedIndex(baseline, shares, interrill),
    rill: weightedIndex(baseline, shares, rill),
  };

  const exposures = plans.map((plan): RotationExposure => {
    const index = weightedIndex(plan, shares, typical);
    // A smaller b means cover protects less, so that end gives the higher index.
    const high = weightedIndex(plan, shares, interrill);
    const low = weightedIndex(plan, shares, rill);
    const bareMonths = plan.months.flatMap((level, monthIndex) => (level === "bare" ? [monthIndex + 1] : []));
    const relativeLow = ratio(low, baselineIndex.rill);
    const relativeHigh = ratio(high, baselineIndex.interrill);

    return {
      planId: plan.id,
      index,
      indexRange: { low, high },
      relativeToBaseline: ratio(index, baselineIndex.typical),
      relativeRange:
        relativeLow === null || relativeHigh === null
          ? null
          : { low: Math.min(relativeLow, relativeHigh), high: Math.max(relativeLow, relativeHigh) },
      bareMonths,
      bareRainyMonths: bareMonths.filter((month) => rain[month - 1] > averageMonth),
      rainShareOnBare:
        annualRain === 0 ? 0 : bareMonths.reduce((sum, month) => sum + rain[month - 1], 0) / annualRain,
    };
  });

  return { baselineId, erosivityShares: shares, exposures };
}
