import { describe, expect, it } from "vitest";

import type { Metric, VegetationObservation } from "../types";
import { aggregateMonthly } from "./landsat-series";
import {
  buildLimitations,
  buildMetrics,
  buildQuality,
  MIN_PIXELS_WITH_INTERIOR,
  monthsWithoutObservation,
} from "./landsat-summary";
import type { SceneCounts } from "./landsat-summary";

const PERIOD = { start: "2025-01-01", end: "2025-06-30" };

function observation(date: string, ndviMean: number | null): VegetationObservation {
  const usable = ndviMean !== null;
  return {
    date,
    sceneId: `scene-${date}`,
    platform: "landsat-8",
    ndviMean,
    ndviMin: ndviMean,
    ndviMax: ndviMean,
    clearPixels: usable ? 43 : 0,
    totalPixels: 43,
    sceneCloudCover: 50,
    usable,
  };
}

const COUNTS: SceneCounts = {
  found: 12,
  examined: 7,
  notTier1: 3,
  failed: 1,
  notReadInTime: 1,
  sameDate: 2,
  passes: 7,
};

const NO_ISSUES: SceneCounts = { ...COUNTS, notTier1: 0, failed: 0, notReadInTime: 0, sameDate: 0 };

/** Oldest first, as the source hands them over. */
const OBSERVATIONS: readonly VegetationObservation[] = [
  observation("2025-01-10", 0.8),
  observation("2025-02-11", null),
  observation("2025-03-15", 0.1),
  observation("2025-03-31", 0.6),
  observation("2025-06-03", 0.5),
];

const byId = (metrics: readonly Metric[], id: string): Metric => {
  const metric = metrics.find((candidate) => candidate.id === id);
  if (!metric) throw new Error(`Missing metric ${id}`);
  return metric;
};

describe("buildMetrics", () => {
  const monthly = aggregateMonthly(OBSERVATIONS, PERIOD);
  const metrics = buildMetrics(OBSERVATIONS, monthly, COUNTS);

  it("summarises the usable observations only", () => {
    expect(byId(metrics, "vegetation.ndviMean")).toEqual({
      id: "vegetation.ndviMean",
      value: 0.5,
      unit: "index",
      aggregation: "mean",
    });
    expect(byId(metrics, "vegetation.usableObservations").value).toBe(4);
  });

  it("dates the lowest, the highest and the latest value", () => {
    expect(byId(metrics, "vegetation.ndviMin")).toMatchObject({ value: 0.1, aggregation: "min", at: { date: "2025-03-15" } });
    expect(byId(metrics, "vegetation.ndviMax")).toMatchObject({ value: 0.8, aggregation: "max", at: { date: "2025-01-10" } });
    expect(byId(metrics, "vegetation.ndviLatest")).toMatchObject({ value: 0.5, aggregation: "value", at: { date: "2025-06-03" } });
  });

  it("counts the months without any usable observation", () => {
    // February (cloudy), April and May (no pass).
    expect(byId(metrics, "vegetation.monthsWithoutObservation")).toMatchObject({ value: 3, unit: "count" });
  });

  it("gives the share under the low-vegetation threshold in percent", () => {
    // One of four usable dates is below 0.2.
    expect(byId(metrics, "vegetation.lowVegetationShare")).toMatchObject({
      value: 25,
      unit: "percent",
      aggregation: "share",
    });
  });

  it("accounts for every scene found", () => {
    const value = (id: string): number => byId(metrics, id).value ?? Number.NaN;
    expect(value("vegetation.scenesFound")).toBe(12);
    expect(value("vegetation.scenesExamined")).toBe(7);
    expect(value("vegetation.scenesNotTier1")).toBe(3);
    expect(value("vegetation.scenesNotRead")).toBe(2);
    expect(value("vegetation.scenesSameDate")).toBe(2);
    expect(
      value("vegetation.scenesExamined") + value("vegetation.scenesNotTier1") + value("vegetation.scenesNotRead"),
    ).toBe(value("vegetation.scenesFound"));
  });

  it("uses only ids in the vegetation namespace, each once", () => {
    const ids = metrics.map((metric) => metric.id);
    expect(ids.every((id) => id.startsWith("vegetation."))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("reports missing values as null and real zeros as zero when nothing was usable", () => {
    const cloudy = [observation("2025-01-10", null), observation("2025-02-11", null)];
    const empty = buildMetrics(cloudy, aggregateMonthly(cloudy, PERIOD), COUNTS);
    for (const id of ["ndviMean", "ndviMin", "ndviMax", "ndviLatest", "lowVegetationShare"]) {
      const metric = byId(empty, `vegetation.${id}`);
      expect(metric.value).toBeNull();
      expect(metric.at).toBeUndefined();
    }
    expect(byId(empty, "vegetation.usableObservations").value).toBe(0);
    expect(byId(empty, "vegetation.monthsWithoutObservation").value).toBe(6);
    expect(byId(empty, "vegetation.scenesFound").value).toBe(12);
  });

  it("reports a zero share when no usable date is low", () => {
    const green = [observation("2025-01-10", 0.8)];
    const result = buildMetrics(green, aggregateMonthly(green, PERIOD), COUNTS);
    expect(byId(result, "vegetation.lowVegetationShare").value).toBe(0);
  });

  it("treats an NDVI exactly at the threshold as not low", () => {
    const atThreshold = [observation("2025-01-10", 0.2), observation("2025-01-26", 0.1999)];
    const result = buildMetrics(atThreshold, aggregateMonthly(atThreshold, PERIOD), COUNTS);
    expect(byId(result, "vegetation.lowVegetationShare").value).toBe(50);
  });
});

describe("buildQuality", () => {
  const monthly = aggregateMonthly(OBSERVATIONS, PERIOD);

  it("compares usable dates with the satellite passes over the area", () => {
    const quality = buildQuality(OBSERVATIONS, monthly, COUNTS);
    expect(quality.expected).toBe(7);
    expect(quality.valid).toBe(4);
    expect(quality.coverage).toBeCloseTo(4 / 7, 12);
  });

  it("adds a note for gaps, unread scenes and the time limit", () => {
    expect(buildQuality(OBSERVATIONS, monthly, COUNTS).notes).toEqual([
      "months-without-observation",
      "scenes-not-read",
      "time-budget-reached",
    ]);
  });

  it("adds no note when every month has a clear date and every scene was read", () => {
    const full = [observation("2025-01-10", 0.7), observation("2025-02-10", 0.7)];
    const twoMonths = aggregateMonthly(full, { start: "2025-01-01", end: "2025-02-28" });
    expect(buildQuality(full, twoMonths, NO_ISSUES).notes).toEqual([]);
  });

  it("has no coverage when there was no pass at all", () => {
    const quality = buildQuality([], aggregateMonthly([], PERIOD), { ...NO_ISSUES, found: 0, examined: 0, passes: 0 });
    expect(quality).toMatchObject({ expected: 0, valid: 0, coverage: null });
  });
});

describe("monthsWithoutObservation", () => {
  it("is zero for an empty list of months", () => {
    expect(monthsWithoutObservation([])).toBe(0);
  });
});

describe("buildLimitations", () => {
  const ALWAYS = [
    "ndvi-is-not-a-diagnosis",
    "low-vegetation-threshold-is-a-convention",
    "cloud-mask-can-miss-clouds",
    "mean-favours-clear-months",
  ];

  it("always states what NDVI cannot say and that the threshold is a convention", () => {
    expect(
      buildLimitations({ scope: "parcel", pixelsInArea: 43, periodCapped: false, counts: NO_ISSUES }),
    ).toEqual(ALWAYS);
  });

  it("adds the cap, the tier and the same-date rule when they applied", () => {
    expect(buildLimitations({ scope: "parcel", pixelsInArea: 43, periodCapped: true, counts: COUNTS })).toEqual([
      ...ALWAYS,
      "period-capped",
      "tier-2-scenes-not-used",
      "same-date-scenes-counted-once",
    ]);
  });

  it("warns about a single pixel and about plots made only of edge pixels", () => {
    const single = buildLimitations({ scope: "pixel", pixelsInArea: 1, periodCapped: false, counts: NO_ISSUES });
    expect(single).toContain("single-pixel");
    expect(single).not.toContain("edge-pixels-mixed");

    const small = buildLimitations({
      scope: "parcel",
      pixelsInArea: MIN_PIXELS_WITH_INTERIOR - 1,
      periodCapped: false,
      counts: NO_ISSUES,
    });
    expect(small).toContain("edge-pixels-mixed");
    expect(small).not.toContain("single-pixel");

    const enough = buildLimitations({
      scope: "parcel",
      pixelsInArea: MIN_PIXELS_WITH_INTERIOR,
      periodCapped: false,
      counts: NO_ISSUES,
    });
    expect(enough).not.toContain("edge-pixels-mixed");
  });
});
