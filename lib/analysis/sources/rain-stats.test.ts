import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { RainMonth } from "../types";
import { parseDailyAverageResponse } from "./climateserv";
import {
  buildAnnual,
  buildClimatology,
  buildMonthly,
  coefficientOfVariationPercent,
  daysInMonth,
  isMonthComplete,
  MIN_VALID_DAY_FRACTION,
  RAIN_METRIC_IDS,
  RAIN_QUALITY_NOTES,
  summarizeRain,
  type DailyRain,
} from "./rain-stats";

/** Real ClimateSERV answers for the 200 m test square in Los Chiles, captured on 2026-11-14. */
function loadYear(year: 2024 | 2025): readonly DailyRain[] {
  const path = fileURLToPath(new URL(`./__fixtures__/rain-imerg-late-v07-${year}.json`, import.meta.url));
  const days = parseDailyAverageResponse(JSON.parse(readFileSync(path, "utf8")) as unknown);
  if (days === null) throw new Error(`Fixture ${year} is not a finished result.`);
  return days;
}

/** Every day of a month with the same value. */
function fillMonth(year: number, month: number, mm: number | null, days = daysInMonth(year, month)): DailyRain[] {
  return Array.from({ length: days }, (_, index) => ({
    date: `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`,
    mm,
  }));
}

function fillYear(year: number, mmPerDay: number): DailyRain[] {
  return Array.from({ length: 12 }, (_, index) => fillMonth(year, index + 1, mmPerDay)).flat();
}

function metricValue(metrics: ReturnType<typeof summarizeRain>["metrics"], id: string) {
  const metric = metrics.find((entry) => entry.id === id);
  if (!metric) throw new Error(`Metric ${id} is missing.`);
  return metric;
}

describe("daysInMonth", () => {
  it("knows leap years", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2025, 12)).toBe(31);
  });
});

describe("buildMonthly", () => {
  const year2025 = { start: "2025-01-01", end: "2025-12-31" };

  it("returns every month of the period as missing when there are no days", () => {
    const monthly = buildMonthly([], year2025);
    expect(monthly).toHaveLength(12);
    expect(monthly.every((month) => month.totalMm === null && month.validDays === 0)).toBe(true);
    expect(monthly[1].expectedDays).toBe(28);
  });

  it("keeps a month of zeros as a real zero and a month without values as missing", () => {
    const days = [...fillMonth(2025, 1, 0), ...fillMonth(2025, 2, null)];
    const monthly = buildMonthly(days, year2025);
    expect(monthly[0]).toMatchObject({ totalMm: 0, validDays: 31, expectedDays: 31 });
    expect(monthly[1]).toMatchObject({ totalMm: null, validDays: 0, expectedDays: 28 });
  });

  it("sums only the valid days", () => {
    const days = [
      { date: "2025-03-01", mm: 10 },
      { date: "2025-03-02", mm: null },
      { date: "2025-03-03", mm: 2.5 },
    ];
    expect(buildMonthly(days, year2025)[2]).toMatchObject({ totalMm: 12.5, validDays: 2 });
  });

  it("ignores days outside the period and counts a repeated date once", () => {
    const days = [
      { date: "2024-12-31", mm: 99 },
      { date: "2025-01-01", mm: 5 },
      { date: "2025-01-01", mm: 7 },
      { date: "2026-01-01", mm: 99 },
    ];
    const monthly = buildMonthly(days, year2025);
    expect(monthly).toHaveLength(12);
    expect(monthly[0]).toMatchObject({ totalMm: 7, validDays: 1 });
  });

  it("counts only the days of a month that the period covers", () => {
    const monthly = buildMonthly([], { start: "2025-01-15", end: "2025-02-10" });
    expect(monthly.map((month) => month.expectedDays)).toEqual([17, 10]);
  });
});

describe("isMonthComplete", () => {
  const month = (validDays: number, expectedDays = 31): RainMonth => ({
    year: 2025,
    month: 1,
    totalMm: validDays > 0 ? 1 : null,
    validDays,
    expectedDays,
  });

  it("applies the named threshold", () => {
    expect(MIN_VALID_DAY_FRACTION).toBe(0.9);
    expect(isMonthComplete(month(31))).toBe(true);
    expect(isMonthComplete(month(28))).toBe(true); // 28 / 31 = 0.903
    expect(isMonthComplete(month(27))).toBe(false); // 27 / 31 = 0.871
    expect(isMonthComplete(month(0))).toBe(false);
  });

  it("rejects a month the period covers only in part", () => {
    expect(isMonthComplete(month(17, 17))).toBe(false);
  });
});

describe("buildClimatology", () => {
  it("always returns 12 months, all missing when there is no data", () => {
    const climatology = buildClimatology(buildMonthly([], { start: "2025-01-01", end: "2025-12-31" }));
    expect(climatology.map((entry) => entry.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(climatology.every((entry) => entry.meanMm === null && entry.years === 0)).toBe(true);
  });

  it("uses complete months only", () => {
    const days = [
      ...fillMonth(2024, 1, 2), // 62 mm, complete
      ...fillMonth(2025, 1, 4), // 124 mm, complete
      ...fillMonth(2026, 1, 10, 20), // only 20 of 31 days: left out
    ];
    const january = buildClimatology(buildMonthly(days, { start: "2024-01-01", end: "2026-12-31" }))[0];
    expect(january).toEqual({ month: 1, meanMm: 93, minMm: 62, maxMm: 124, years: 2 });
  });
});

describe("buildAnnual", () => {
  it("marks a year as incomplete when one whole month is missing", () => {
    const days = fillYear(2025, 1).filter((day) => !day.date.startsWith("2025-06"));
    const [year] = buildAnnual(buildMonthly(days, { start: "2025-01-01", end: "2025-12-31" }));
    // 335 of 365 days (92%) have a value, yet the year lacks all of June.
    expect(year).toEqual({ year: 2025, totalMm: 335, validDays: 335, expectedDays: 365, complete: false });
  });

  it("gives a year without any value a missing total, not zero", () => {
    const [year] = buildAnnual(buildMonthly([], { start: "2025-01-01", end: "2025-12-31" }));
    expect(year).toEqual({ year: 2025, totalMm: null, validDays: 0, expectedDays: 365, complete: false });
  });

  it("gives a year without rain a total of zero and counts it as complete", () => {
    const [year] = buildAnnual(buildMonthly(fillYear(2025, 0), { start: "2025-01-01", end: "2025-12-31" }));
    expect(year).toMatchObject({ totalMm: 0, validDays: 365, complete: true });
  });
});

describe("coefficientOfVariationPercent", () => {
  it("is the sample standard deviation over the mean", () => {
    expect(coefficientOfVariationPercent([100, 200, 300])).toBe(50);
    expect(coefficientOfVariationPercent([2000, 2000])).toBe(0);
  });

  it("is missing with fewer than two years or when it never rained", () => {
    expect(coefficientOfVariationPercent([])).toBeNull();
    expect(coefficientOfVariationPercent([2500])).toBeNull();
    expect(coefficientOfVariationPercent([0, 0, 0])).toBeNull();
  });
});

describe("summarizeRain", () => {
  it("handles an empty answer: every value missing, nothing invented", () => {
    const summary = summarizeRain([], { start: "2023-01-01", end: "2025-12-31" });
    expect(summary.data.annual).toHaveLength(3);
    expect(summary.quality).toMatchObject({ expected: 1096, valid: 0, coverage: 0 });
    expect(metricValue(summary.metrics, RAIN_METRIC_IDS.yearsUsed).value).toBe(0);
    const others = summary.metrics.filter((metric) => metric.id !== RAIN_METRIC_IDS.yearsUsed);
    expect(others.every((metric) => metric.value === null && metric.at === undefined)).toBe(true);
  });

  it("computes the yearly figures from complete years", () => {
    const days = [...fillYear(2023, 5), ...fillYear(2024, 10), ...fillYear(2025, 6)];
    const { metrics, quality } = summarizeRain(days, { start: "2023-01-01", end: "2025-12-31" });

    expect(metricValue(metrics, RAIN_METRIC_IDS.annualMean)).toMatchObject({ value: 2558.3, unit: "mm/year" });
    expect(metricValue(metrics, RAIN_METRIC_IDS.driestYear)).toMatchObject({ value: 1825, at: { year: 2023 } });
    expect(metricValue(metrics, RAIN_METRIC_IDS.wettestYear)).toMatchObject({ value: 3660, at: { year: 2024 } });
    // Totals 1825, 3660 and 2190: mean 2558.33, sample standard deviation 971.37, ratio 37.97%.
    expect(metricValue(metrics, RAIN_METRIC_IDS.interannualCv)).toMatchObject({ value: 38, unit: "percent" });
    expect(metricValue(metrics, RAIN_METRIC_IDS.yearsUsed).value).toBe(3);
    expect(quality).toEqual({ expected: 1096, valid: 1096, coverage: 1, notes: [] });
  });

  it("tells a year the service did not answer from days missing in the product", () => {
    const period = { start: "2024-01-01", end: "2025-12-31" };
    const onlyFailure = summarizeRain(fillYear(2025, 3), period, [2024]);
    expect(onlyFailure.quality.notes).toEqual([
      RAIN_QUALITY_NOTES.yearsFailed,
      RAIN_QUALITY_NOTES.incompleteYears,
      RAIN_QUALITY_NOTES.tooFewYears,
    ]);
    expect(onlyFailure.quality.coverage).toBeCloseTo(365 / 731, 6);

    const onlyGap = summarizeRain(fillYear(2025, 3).slice(10), { start: "2025-01-01", end: "2025-12-31" });
    expect(onlyGap.quality.notes).toContain(RAIN_QUALITY_NOTES.missingDays);
    expect(onlyGap.quality.notes).not.toContain(RAIN_QUALITY_NOTES.yearsFailed);
  });

  describe("with the real 2024 and 2025 answers for Los Chiles", () => {
    const summary = summarizeRain([...loadYear(2024), ...loadYear(2025)], {
      start: "2024-01-01",
      end: "2025-12-31",
    });
    const monthOf = (year: number, month: number) =>
      summary.data.monthly.find((entry) => entry.year === year && entry.month === month);

    it("keeps February 2024 (29 days, no rain) apart from May 2024 (no data at all)", () => {
      expect(monthOf(2024, 2)).toEqual({ year: 2024, month: 2, totalMm: 0, validDays: 29, expectedDays: 29 });
      expect(monthOf(2024, 5)).toEqual({ year: 2024, month: 5, totalMm: null, validDays: 0, expectedDays: 31 });
    });

    it("gives yearly totals that fit northern Costa Rica and its dry season", () => {
      expect(summary.data.annual).toEqual([
        { year: 2024, totalMm: 2352.3, validDays: 334, expectedDays: 366, complete: false },
        { year: 2025, totalMm: 2647.9, validDays: 365, expectedDays: 365, complete: true },
      ]);
      expect(monthOf(2025, 4)?.totalMm).toBe(11.3);
      expect(monthOf(2025, 6)?.totalMm).toBe(581.5);
    });

    it("leaves the incomplete year out of the yearly figures and says so", () => {
      const { metrics, quality } = summary;
      expect(metricValue(metrics, RAIN_METRIC_IDS.yearsUsed).value).toBe(1);
      expect(metricValue(metrics, RAIN_METRIC_IDS.annualMean).value).toBe(2647.9);
      expect(metricValue(metrics, RAIN_METRIC_IDS.driestYear)).toMatchObject({ value: 2647.9, at: { year: 2025 } });
      expect(metricValue(metrics, RAIN_METRIC_IDS.interannualCv).value).toBeNull();
      expect(quality).toMatchObject({ expected: 731, valid: 699 });
      expect(quality.notes).toEqual([
        RAIN_QUALITY_NOTES.missingDays,
        RAIN_QUALITY_NOTES.incompleteYears,
        RAIN_QUALITY_NOTES.tooFewYears,
      ]);
    });

    it("builds the calendar months from complete months only", () => {
      const { climatology } = summary.data;
      expect(climatology[4]).toEqual({ month: 5, meanMm: 235.1, minMm: 235.1, maxMm: 235.1, years: 1 });
      expect(climatology[1]).toEqual({ month: 2, meanMm: 25.1, minMm: 0, maxMm: 50.2, years: 2 });

      const wettest = metricValue(summary.metrics, RAIN_METRIC_IDS.wettestMonth);
      expect(wettest.at).toEqual({ month: 7 });
      expect(wettest.value).toBeCloseTo(465.65, 0);
      expect(metricValue(summary.metrics, RAIN_METRIC_IDS.driestMonth)).toMatchObject({
        value: 20.9,
        unit: "mm/month",
        at: { month: 3 },
      });
    });
  });
});
