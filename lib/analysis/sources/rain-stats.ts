import type {
  DateRange,
  Metric,
  Quality,
  RainClimatologyMonth,
  RainData,
  RainMonth,
  RainYear,
} from "../types";

/**
 * Statistics of daily rainfall, with no network code: everything here is a pure
 * function of the daily values, so it can be tested with captured responses.
 *
 * The rule that runs through the whole file: a day with no value (`null`) is
 * missing and is never counted as a dry day. Zero is a real day without rain.
 */

/** One calendar day of rain. `mm` is `null` when the product has no value for that day. */
export interface DailyRain {
  /** YYYY-MM-DD */
  readonly date: string;
  readonly mm: number | null;
}

/**
 * Completeness threshold. A month is "complete" when at least this share of its
 * days has a value (9 in 10: at most 3 missing days in a 31-day month). Its
 * total is then comparable with the same month of other years. The value is
 * this project's own choice, not something the data provider prescribes.
 * A year is "complete" when all of its 12 months are, so a year that lacks one
 * whole month never counts as complete even though 92% of its days are there.
 */
export const MIN_VALID_DAY_FRACTION = 0.9;

/** Years needed before the spread between years is reported (a spread needs at least two values). */
export const MIN_YEARS_FOR_VARIABILITY = 2;

/**
 * Decimals kept in the results. The IMERG files behind the service store rain
 * in steps of 0.1 mm, so more decimals would only show float noise.
 */
const RESULT_DECIMALS = 1;

const MONTHS_PER_YEAR = 12;

export const RAIN_METRIC_IDS = {
  annualMean: "rain.annualMean",
  driestYear: "rain.driestYear",
  wettestYear: "rain.wettestYear",
  interannualCv: "rain.interannualCv",
  wettestMonth: "rain.wettestMonth",
  driestMonth: "rain.driestMonth",
  yearsUsed: "rain.yearsUsed",
} as const;

export const RAIN_QUALITY_NOTES = {
  /** Some of the yearly requests failed, so whole years are absent. */
  yearsFailed: "rain.yearsFailed",
  /** The service answered, but some days have no value. */
  missingDays: "rain.missingDays",
  /** At least one year was left out of the yearly figures because it is incomplete. */
  incompleteYears: "rain.incompleteYears",
  /** Too few complete years to say how much the years differ. */
  tooFewYears: "rain.tooFewYears",
} as const;

export interface RainSummary {
  readonly data: RainData;
  readonly metrics: readonly Metric[];
  readonly quality: Quality;
}

function round(value: number): number {
  const factor = 10 ** RESULT_DECIMALS;
  return Math.round(value * factor) / factor;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Days in a calendar month (month 1 to 12), leap years included. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

interface PeriodMonth {
  readonly year: number;
  readonly month: number;
  /** Days of this month that fall inside the period. */
  readonly expectedDays: number;
}

/** Every calendar month touched by the period, with the days of it that the period covers. */
function monthsOfPeriod(period: DateRange): readonly PeriodMonth[] {
  const [startYear, startMonth, startDay] = period.start.split("-").map(Number);
  const [endYear, endMonth, endDay] = period.end.split("-").map(Number);
  const months: PeriodMonth[] = [];

  for (let year = startYear; year <= endYear; year += 1) {
    const firstMonth = year === startYear ? startMonth : 1;
    const lastMonth = year === endYear ? endMonth : MONTHS_PER_YEAR;
    for (let month = firstMonth; month <= lastMonth; month += 1) {
      const firstDay = year === startYear && month === startMonth ? startDay : 1;
      const lastDay = year === endYear && month === endMonth ? endDay : daysInMonth(year, month);
      months.push({ year, month, expectedDays: Math.max(0, lastDay - firstDay + 1) });
    }
  }
  return months;
}

/**
 * Monthly totals over the period. Days outside the period are ignored, and a
 * date that appears twice counts once (the last value wins), so a repeated row
 * can never inflate a total.
 */
export function buildMonthly(days: readonly DailyRain[], period: DateRange): readonly RainMonth[] {
  const byDate = new Map<string, number | null>();
  for (const day of days) {
    if (day.date >= period.start && day.date <= period.end) byDate.set(day.date, day.mm);
  }

  const sums = new Map<string, { total: number; validDays: number }>();
  for (const [date, mm] of byDate) {
    if (mm === null) continue;
    const key = date.slice(0, 7);
    const current = sums.get(key) ?? { total: 0, validDays: 0 };
    sums.set(key, { total: current.total + mm, validDays: current.validDays + 1 });
  }

  return monthsOfPeriod(period).map(({ year, month, expectedDays }) => {
    const sum = sums.get(monthKey(year, month));
    return {
      year,
      month,
      totalMm: sum ? round(sum.total) : null,
      validDays: sum?.validDays ?? 0,
      expectedDays,
    };
  });
}

/** True when the period covers the whole calendar month and enough of its days have a value. */
export function isMonthComplete(month: RainMonth): boolean {
  const coversWholeMonth = month.expectedDays === daysInMonth(month.year, month.month);
  return coversWholeMonth && month.validDays / month.expectedDays >= MIN_VALID_DAY_FRACTION;
}

/** The 12 calendar months, January first, averaged over the years in which each one is complete. */
export function buildClimatology(monthly: readonly RainMonth[]): readonly RainClimatologyMonth[] {
  return Array.from({ length: MONTHS_PER_YEAR }, (_, index) => {
    const month = index + 1;
    const totals = monthly
      .filter((entry) => entry.month === month && isMonthComplete(entry))
      .map((entry) => entry.totalMm)
      .filter((total): total is number => total !== null);

    if (totals.length === 0) return { month, meanMm: null, minMm: null, maxMm: null, years: 0 };
    return {
      month,
      meanMm: round(mean(totals)),
      minMm: Math.min(...totals),
      maxMm: Math.max(...totals),
      years: totals.length,
    };
  });
}

/** One entry per calendar year of the period, oldest first. */
export function buildAnnual(monthly: readonly RainMonth[]): readonly RainYear[] {
  const years = [...new Set(monthly.map((entry) => entry.year))].sort((a, b) => a - b);

  return years.map((year) => {
    const months = monthly.filter((entry) => entry.year === year);
    const totals = months.map((entry) => entry.totalMm).filter((total): total is number => total !== null);
    return {
      year,
      totalMm: totals.length > 0 ? round(totals.reduce((sum, total) => sum + total, 0)) : null,
      validDays: months.reduce((sum, entry) => sum + entry.validDays, 0),
      expectedDays: months.reduce((sum, entry) => sum + entry.expectedDays, 0),
      complete: months.length === MONTHS_PER_YEAR && months.every(isMonthComplete),
    };
  });
}

/**
 * Spread between years as a percentage of their mean: the sample standard
 * deviation (divided by n − 1, because the years are a sample of the climate)
 * over the mean. `null` with fewer than two years or when it never rained.
 */
export function coefficientOfVariationPercent(values: readonly number[]): number | null {
  if (values.length < MIN_YEARS_FOR_VARIABILITY) return null;
  const average = mean(values);
  if (average === 0) return null;
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return round((Math.sqrt(variance) / average) * 100);
}

interface CompleteYear {
  readonly year: number;
  readonly totalMm: number;
}

function completeYears(annual: readonly RainYear[]): readonly CompleteYear[] {
  return annual.flatMap((entry) =>
    entry.complete && entry.totalMm !== null ? [{ year: entry.year, totalMm: entry.totalMm }] : [],
  );
}

/** The first entry with the lowest (or highest) value; ties go to the earliest one. */
function extreme<T>(items: readonly T[], valueOf: (item: T) => number, pick: "min" | "max"): T | null {
  return items.reduce<T | null>((best, item) => {
    if (best === null) return item;
    const isBetter = pick === "min" ? valueOf(item) < valueOf(best) : valueOf(item) > valueOf(best);
    return isBetter ? item : best;
  }, null);
}

function yearMetrics(annual: readonly RainYear[]): readonly Metric[] {
  const usable = completeYears(annual);
  const totals = usable.map((entry) => entry.totalMm);
  const driest = extreme(usable, (entry) => entry.totalMm, "min");
  const wettest = extreme(usable, (entry) => entry.totalMm, "max");

  return [
    {
      id: RAIN_METRIC_IDS.annualMean,
      value: totals.length > 0 ? round(mean(totals)) : null,
      unit: "mm/year",
      aggregation: "mean",
    },
    {
      id: RAIN_METRIC_IDS.driestYear,
      value: driest?.totalMm ?? null,
      unit: "mm/year",
      aggregation: "min",
      ...(driest ? { at: { year: driest.year } } : {}),
    },
    {
      id: RAIN_METRIC_IDS.wettestYear,
      value: wettest?.totalMm ?? null,
      unit: "mm/year",
      aggregation: "max",
      ...(wettest ? { at: { year: wettest.year } } : {}),
    },
    {
      id: RAIN_METRIC_IDS.interannualCv,
      value: coefficientOfVariationPercent(totals),
      unit: "percent",
      aggregation: "coefficient-of-variation",
    },
  ];
}

function monthMetrics(climatology: readonly RainClimatologyMonth[]): readonly Metric[] {
  const known = climatology.flatMap((entry) =>
    entry.meanMm !== null ? [{ month: entry.month, meanMm: entry.meanMm }] : [],
  );
  const wettest = extreme(known, (entry) => entry.meanMm, "max");
  const driest = extreme(known, (entry) => entry.meanMm, "min");

  return [
    {
      id: RAIN_METRIC_IDS.wettestMonth,
      value: wettest?.meanMm ?? null,
      unit: "mm/month",
      aggregation: "max",
      ...(wettest ? { at: { month: wettest.month } } : {}),
    },
    {
      id: RAIN_METRIC_IDS.driestMonth,
      value: driest?.meanMm ?? null,
      unit: "mm/month",
      aggregation: "min",
      ...(driest ? { at: { month: driest.month } } : {}),
    },
  ];
}

export function buildMetrics(data: RainData): readonly Metric[] {
  return [
    ...yearMetrics(data.annual),
    ...monthMetrics(data.climatology),
    {
      id: RAIN_METRIC_IDS.yearsUsed,
      value: completeYears(data.annual).length,
      unit: "count",
      aggregation: "count",
    },
  ];
}

function buildQuality(data: RainData, failedYears: readonly number[]): Quality {
  const expected = data.annual.reduce((sum, entry) => sum + entry.expectedDays, 0);
  const valid = data.annual.reduce((sum, entry) => sum + entry.validDays, 0);
  const failed = new Set(failedYears);
  // Days missing in years whose request did work: a gap in the product itself.
  const hasGapsInAnsweredYears = data.annual.some(
    (entry) => !failed.has(entry.year) && entry.validDays < entry.expectedDays,
  );
  const usableYears = completeYears(data.annual).length;

  const notes = [
    ...(failedYears.length > 0 ? [RAIN_QUALITY_NOTES.yearsFailed] : []),
    ...(hasGapsInAnsweredYears ? [RAIN_QUALITY_NOTES.missingDays] : []),
    ...(usableYears < data.annual.length ? [RAIN_QUALITY_NOTES.incompleteYears] : []),
    ...(usableYears < MIN_YEARS_FOR_VARIABILITY ? [RAIN_QUALITY_NOTES.tooFewYears] : []),
  ];

  return { expected, valid, coverage: expected > 0 ? valid / expected : null, notes };
}

/**
 * Turns daily rain into everything the rain source returns.
 * `failedYears` lists the years whose request failed, so the quality notes can
 * tell "the service did not answer for 2019" from "2019 has days without data".
 */
export function summarizeRain(
  days: readonly DailyRain[],
  period: DateRange,
  failedYears: readonly number[] = [],
): RainSummary {
  const monthly = buildMonthly(days, period);
  const data: RainData = {
    monthly,
    climatology: buildClimatology(monthly),
    annual: buildAnnual(monthly),
  };
  return { data, metrics: buildMetrics(data), quality: buildQuality(data, failedYears) };
}
