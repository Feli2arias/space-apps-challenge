import { describe, expect, it } from "vitest";
import {
  formatCoordinate,
  formatDate,
  formatDateRange,
  formatDistance,
  formatDuration,
  formatInstantUtc,
  formatMetricMoment,
  formatMetricValue,
  formatNumber,
  formatShare,
  formatValue,
  formatValueWithUnit,
  fractionDigitsFor,
  joinValueAndUnit,
  monthName,
  unitLabel,
} from "./format";
import type { Metric } from "./types";

const NBSP = " ";

describe("formatNumber", () => {
  it("uses a decimal comma in Spanish and a decimal point in English", () => {
    expect(formatNumber(1.26, "es", 2)).toBe("1,26");
    expect(formatNumber(1.26, "en", 2)).toBe("1.26");
  });

  it("groups thousands the way each language writes them", () => {
    expect(formatNumber(12345.6, "es", 1)).toBe(`12${NBSP}345,6`);
    expect(formatNumber(12345.6, "en", 1)).toBe("12,345.6");
  });

  it("writes zero as zero and missing as null", () => {
    expect(formatNumber(0, "es")).toBe("0");
    expect(formatNumber(null, "es")).toBeNull();
    expect(formatNumber(undefined, "en")).toBeNull();
    expect(formatNumber(Number.NaN, "es")).toBeNull();
    expect(formatNumber(Number.POSITIVE_INFINITY, "en")).toBeNull();
  });

  it("never prints a negative zero", () => {
    expect(formatNumber(-0.04, "en", 1)).toBe("0.0");
    expect(formatNumber(-3.25, "en", 1)).toMatch(/^-3\.[23]$/);
  });
});

describe("fractionDigitsFor", () => {
  it("gives small values one more decimal than large ones", () => {
    expect(fractionDigitsFor("mm", 3.4)).toBe(1);
    expect(fractionDigitsFor("mm", 1840)).toBe(0);
    expect(fractionDigitsFor("percent", 9.9)).toBe(1);
    expect(fractionDigitsFor("percent", 45)).toBe(0);
    expect(fractionDigitsFor("ha", 4)).toBe(2);
    expect(fractionDigitsFor("ha", 42)).toBe(1);
    expect(fractionDigitsFor("ha", 420)).toBe(0);
  });

  it("keeps two decimals for an index and none for counts", () => {
    expect(fractionDigitsFor("index", 0.5)).toBe(2);
    expect(fractionDigitsFor("count", 12)).toBe(0);
    expect(fractionDigitsFor("celsius", 24)).toBe(1);
  });
});

describe("formatValue", () => {
  it("separates the number from its unit", () => {
    expect(formatValue(1840.4, "mm/year", "es")).toEqual({ text: `1${NBSP}840`, unit: "mm/año" });
    expect(formatValue(1840.4, "mm/year", "en")).toEqual({ text: "1,840", unit: "mm/year" });
    expect(formatValue(0.456, "index", "es")).toEqual({ text: "0,46", unit: "" });
  });

  it("writes a month value as the month's name", () => {
    expect(formatValue(9, "month", "es")).toEqual({ text: "septiembre", unit: "" });
    expect(formatValue(9, "month", "en")).toEqual({ text: "September", unit: "" });
    expect(formatValue(13, "month", "es")).toBeNull();
  });

  it("writes a year without a thousands separator", () => {
    expect(formatValue(2023, "year", "es")).toEqual({ text: "2023", unit: "" });
    expect(formatValue(2023, "year", "en")).toEqual({ text: "2023", unit: "" });
  });

  it("tells zero and missing apart", () => {
    expect(formatValue(0, "mm", "es")).toEqual({ text: "0,0", unit: "mm" });
    expect(formatValue(null, "mm", "es")).toBeNull();
  });
});

describe("joinValueAndUnit and formatValueWithUnit", () => {
  it("puts a non-breaking space before most units", () => {
    expect(formatValueWithUnit(24.56, "celsius", "es")).toBe(`24,6${NBSP}°C`);
    expect(formatValueWithUnit(120, "m", "en")).toBe(`120${NBSP}m`);
  });

  it("writes percent with a space in Spanish and without in English", () => {
    expect(formatValueWithUnit(42, "percent", "es")).toBe(`42${NBSP}%`);
    expect(formatValueWithUnit(42, "percent", "en")).toBe("42%");
  });

  it("attaches the degree sign and omits empty units", () => {
    expect(joinValueAndUnit({ text: "3,2", unit: "°" }, "es")).toBe("3,2°");
    expect(joinValueAndUnit({ text: "0,46", unit: "" }, "es")).toBe("0,46");
  });

  it("writes pH before the number", () => {
    expect(formatValueWithUnit(5.54, "pH", "es")).toBe(`pH${NBSP}5,5`);
  });

  it("returns null for a missing value", () => {
    expect(formatValueWithUnit(null, "mm", "en")).toBeNull();
  });
});

describe("formatMetricValue", () => {
  const metric = (value: number | null): Metric => ({
    id: "rain.annualMean",
    value,
    unit: "mm/year",
    aggregation: "mean",
  });

  it("formats a present value and returns null for a missing one", () => {
    expect(formatMetricValue(metric(0), "en")).toEqual({ text: "0.0", unit: "mm/year" });
    expect(formatMetricValue(metric(null), "en")).toBeNull();
  });
});

describe("unitLabel and monthName", () => {
  it("translates the units that contain words", () => {
    expect(unitLabel("mm/month", "es")).toBe("mm/mes");
    expect(unitLabel("mm/month", "en")).toBe("mm/month");
    expect(unitLabel("count", "es")).toBe("");
  });

  it("names months from 1 to 12 and rejects everything else", () => {
    expect(monthName(1, "es", "short")).toBe("ene");
    expect(monthName(12, "en", "long")).toBe("December");
    expect(monthName(0, "es")).toBeNull();
    expect(monthName(13, "es")).toBeNull();
    expect(monthName(1.5, "es")).toBeNull();
    expect(monthName(null, "es")).toBeNull();
  });
});

describe("dates", () => {
  it("formats a calendar date in each language", () => {
    expect(formatDate("2026-11-14", "es")).toBe("14 nov 2026");
    expect(formatDate("2026-11-14", "en")).toBe("Nov 14, 2026");
  });

  it("does not shift the first day of the year into the year before", () => {
    expect(formatDate("2021-01-01", "es")).toBe("1 ene 2021");
  });

  it("rejects text that is not a real date", () => {
    expect(formatDate("2021-02-31", "es")).toBeNull();
    expect(formatDate("14/11/2026", "es")).toBeNull();
    expect(formatDate("", "es")).toBeNull();
    expect(formatDate(null, "es")).toBeNull();
  });

  it("formats a range and refuses a broken one", () => {
    expect(formatDateRange({ start: "2021-01-01", end: "2025-12-31" }, "es")).toBe(
      "1 ene 2021 – 31 dic 2025",
    );
    expect(formatDateRange({ start: "2021-01-01", end: "nope" }, "es")).toBeNull();
    expect(formatDateRange(null, "es")).toBeNull();
  });

  it("writes an instant in UTC and says so", () => {
    expect(formatInstantUtc("2026-11-14T17:05:09.000Z", "es")).toBe("14 nov 2026, 17:05 UTC");
    expect(formatInstantUtc("2026-11-14T23:30:00-06:00", "en")).toBe("Nov 15, 2026, 05:30 UTC");
    expect(formatInstantUtc("not a date", "es")).toBeNull();
    expect(formatInstantUtc("", "es")).toBeNull();
  });
});

describe("formatMetricMoment", () => {
  it("prefers the full date, then month and year, then whichever exists", () => {
    expect(formatMetricMoment({ date: "2024-03-09", year: 2024 }, "es")).toBe("9 mar 2024");
    expect(formatMetricMoment({ year: 2022, month: 10 }, "es")).toBe("octubre de 2022");
    expect(formatMetricMoment({ year: 2022, month: 10 }, "en")).toBe("October 2022");
    expect(formatMetricMoment({ month: 2 }, "es")).toBe("febrero");
    expect(formatMetricMoment({ year: 2022 }, "en")).toBe("2022");
  });

  it("returns null when there is no moment", () => {
    expect(formatMetricMoment(undefined, "es")).toBeNull();
    expect(formatMetricMoment({}, "es")).toBeNull();
  });
});

describe("formatCoordinate", () => {
  it("keeps five decimals and a decimal point", () => {
    expect(formatCoordinate(10.95)).toBe("10.95000");
    expect(formatCoordinate(-84.7200049)).toBe("-84.72000");
    expect(formatCoordinate(null)).toBeNull();
  });
});

describe("formatDistance, formatShare and formatDuration", () => {
  it("switches to kilometres for large pixels", () => {
    expect(formatDistance(30, "es")).toBe(`30${NBSP}m`);
    expect(formatDistance(250, "en")).toBe(`250${NBSP}m`);
    expect(formatDistance(5566, "es")).toBe(`5,6${NBSP}km`);
    expect(formatDistance(55660, "en")).toBe(`56${NBSP}km`);
    expect(formatDistance(null, "es")).toBeNull();
  });

  it("writes a share from 0 to 1 as a percentage", () => {
    expect(formatShare(0.42, "es")).toBe(`42${NBSP}%`);
    expect(formatShare(0, "en")).toBe("0.0%");
    expect(formatShare(null, "en")).toBeNull();
  });

  it("writes a duration in seconds", () => {
    expect(formatDuration(2345, "es")).toBe(`2,3${NBSP}s`);
    expect(formatDuration(-1, "es")).toBeNull();
    expect(formatDuration(null, "es")).toBeNull();
  });
});
