import { describe, expect, it } from "vitest";
import type { Metric, RainClimatologyMonth, VegetationMonth } from "@/lib/analysis/types";
import { SAMPLE_COMPLETE, SAMPLE_FAILED, SAMPLE_PARTIAL } from "./preview-samples";
import {
  ELEVATION_MISMATCH_THRESHOLD_METERS,
  buildRainChart,
  buildVegetationTimeline,
  checkElevationMismatch,
  countScenes,
  findMeanElevation,
  summariseSources,
  toHttpUrl,
} from "./view-model";

describe("summariseSources", () => {
  it("sorts sources by what they returned, in display order", () => {
    expect(summariseSources(SAMPLE_COMPLETE)).toEqual({
      withData: ["rain", "vegetation", "terrain", "soil", "climate"],
      noData: [],
      failed: [],
    });
    expect(summariseSources(SAMPLE_PARTIAL)).toEqual({
      withData: ["vegetation", "terrain", "climate"],
      noData: ["soil"],
      failed: ["rain"],
    });
    expect(summariseSources(SAMPLE_FAILED).failed).toHaveLength(5);
  });

  it("reports a source that is absent from the response as failed", () => {
    const { rain, ...rest } = SAMPLE_COMPLETE.sources;
    expect(rain.source).toBe("rain");
    const broken = { ...SAMPLE_COMPLETE, sources: rest } as unknown as typeof SAMPLE_COMPLETE;
    expect(summariseSources(broken).failed).toEqual(["rain"]);
  });
});

describe("buildRainChart", () => {
  const month = (
    number: number,
    meanMm: number | null,
    minMm: number | null = null,
    maxMm: number | null = null,
  ): RainClimatologyMonth => ({ month: number, meanMm, minMm, maxMm, years: 5 });

  it("always returns twelve rows, January first", () => {
    const chart = buildRainChart([month(3, 30), month(1, 10)]);
    expect(chart.rows.map((row) => row.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(chart.rows[0].meanMm).toBe(10);
    expect(chart.rows[1].meanMm).toBeNull();
  });

  it("scales bars by the largest value present, including maxima", () => {
    const chart = buildRainChart([month(1, 50, 20, 200), month(2, 100)]);
    expect(chart.scaleMaxMm).toBe(200);
    expect(chart.rows[0].meanShare).toBe(0.25);
    expect(chart.rows[0].rangeShare).toEqual({ from: 0.1, to: 1 });
    expect(chart.rows[1].meanShare).toBe(0.5);
    expect(chart.rows[1].rangeShare).toBeNull();
  });

  it("keeps a real zero apart from a missing month", () => {
    const chart = buildRainChart([month(1, 0, 0, 0), month(2, null), month(3, 40)]);
    expect(chart.rows[0].meanMm).toBe(0);
    expect(chart.rows[0].meanShare).toBe(0);
    expect(chart.rows[1].meanMm).toBeNull();
    expect(chart.rows[1].meanShare).toBeNull();
  });

  it("handles empty and all-missing input without dividing by zero", () => {
    expect(buildRainChart([]).hasValues).toBe(false);
    expect(buildRainChart(null).scaleMaxMm).toBeNull();
    const allMissing = buildRainChart([month(1, null), month(2, null)]);
    expect(allMissing.hasValues).toBe(false);
    expect(allMissing.rows.every((row) => row.meanShare === null)).toBe(true);
    const allZero = buildRainChart([month(1, 0), month(2, 0)]);
    expect(allZero.hasValues).toBe(true);
    expect(allZero.rows[0].meanShare).toBe(0);
  });
});

describe("buildVegetationTimeline", () => {
  const entry = (
    year: number,
    month: number,
    ndviMean: number | null,
    usable: number,
    total: number,
  ): VegetationMonth => ({
    year,
    month,
    ndviMean,
    usableObservations: usable,
    totalObservations: total,
  });
  const period = { start: "2023-03-01", end: "2024-02-29" };

  it("draws one row of twelve cells per calendar year of the period", () => {
    const timeline = buildVegetationTimeline([], period);
    expect(timeline.years.map((year) => year.year)).toEqual([2023, 2024]);
    expect(timeline.years.every((year) => year.cells.length === 12)).toBe(true);
    expect(timeline.monthsInPeriod).toBe(12);
  });

  it("marks months outside the period, months with no scene and months with no usable scene", () => {
    const timeline = buildVegetationTimeline(
      [entry(2023, 3, 0.6, 1, 2), entry(2023, 4, null, 0, 3), entry(2023, 5, null, 0, 0)],
      period,
    );
    const states = timeline.years[0].cells.map((cell) => cell.state);
    expect(states.slice(0, 6)).toEqual(["outside", "outside", "usable", "unusable", "none", "none"]);
    expect(timeline.usableMonths).toBe(1);
  });

  it("never fills a gap from its neighbours", () => {
    const timeline = buildVegetationTimeline(
      [entry(2023, 3, 0.6, 1, 1), entry(2023, 5, 0.8, 1, 1)],
      period,
    );
    const april = timeline.years[0].cells[3];
    expect(april.state).toBe("none");
    expect(april.ndviMean).toBeNull();
    expect(april.heightShare).toBeNull();
  });

  it("clamps the column height to 0–1 but keeps the real NDVI", () => {
    const timeline = buildVegetationTimeline(
      [entry(2023, 3, -0.2, 1, 1), entry(2023, 4, 0, 1, 1)],
      period,
    );
    const [march, april] = timeline.years[0].cells.slice(2, 4);
    expect(march).toMatchObject({ state: "usable", ndviMean: -0.2, heightShare: 0 });
    expect(april).toMatchObject({ state: "usable", ndviMean: 0, heightShare: 0 });
  });

  it("falls back to the span of the data when there is no period", () => {
    const timeline = buildVegetationTimeline([entry(2022, 11, 0.5, 1, 1)], null);
    expect(timeline.years).toHaveLength(1);
    expect(timeline.monthsInPeriod).toBe(1);
  });

  it("returns nothing for empty input with no period", () => {
    expect(buildVegetationTimeline([], null).years).toEqual([]);
    expect(buildVegetationTimeline(null, undefined).years).toEqual([]);
  });
});

describe("countScenes", () => {
  it("counts usable and total scenes, and copes with nothing", () => {
    const data = SAMPLE_COMPLETE.sources.vegetation.data;
    const counts = countScenes(data?.observations);
    expect(counts.total).toBe(data?.observations.length);
    expect(counts.usable).toBeGreaterThan(0);
    expect(counts.usable).toBeLessThan(counts.total);
    expect(countScenes(null)).toEqual({ total: 0, usable: 0 });
  });
});

describe("findMeanElevation", () => {
  const metric = (id: string, value: number | null, extra: Partial<Metric> = {}): Metric => ({
    id,
    value,
    unit: "m",
    aggregation: "mean",
    ...extra,
  });

  it("finds the mean in metres whose id mentions elevation", () => {
    expect(
      findMeanElevation([
        metric("terrain.slopeMean", 5, { unit: "percent" }),
        metric("terrain.elevationMin", 90, { aggregation: "min" }),
        metric("terrain.elevationMean", 120),
        metric("terrain.reliefMean", 30),
      ]),
    ).toBe(120);
  });

  it("uses the only mean in metres when no id mentions elevation", () => {
    expect(findMeanElevation([metric("terrain.heightMean", 120)])).toBe(120);
  });

  it("guesses nothing when the choice is ambiguous or the value is missing", () => {
    expect(findMeanElevation([metric("a.mean", 1), metric("b.mean", 2)])).toBeNull();
    expect(findMeanElevation([metric("terrain.elevationMean", null)])).toBeNull();
    expect(findMeanElevation([])).toBeNull();
    expect(findMeanElevation(null)).toBeNull();
  });

  it("accepts an elevation of zero", () => {
    expect(findMeanElevation([metric("terrain.elevationMean", 0)])).toBe(0);
  });
});

describe("checkElevationMismatch", () => {
  const { terrain, climate } = SAMPLE_COMPLETE.sources;
  const climateAt = (meters: number | null) => ({
    ...climate,
    data: { monthly: [], gridCellElevationMeters: meters },
  });

  it("reports the difference when it is larger than the threshold", () => {
    expect(checkElevationMismatch(terrain, climate)).toEqual({
      terrainMeters: 1234,
      gridCellMeters: 234,
      differenceMeters: 1000,
    });
  });

  it("stays silent at or under the threshold", () => {
    expect(checkElevationMismatch(terrain, climateAt(1234))).toBeNull();
    expect(
      checkElevationMismatch(terrain, climateAt(1234 - ELEVATION_MISMATCH_THRESHOLD_METERS)),
    ).toBeNull();
    expect(
      checkElevationMismatch(terrain, climateAt(1234 + ELEVATION_MISMATCH_THRESHOLD_METERS + 1)),
    ).not.toBeNull();
  });

  it("stays silent when either side is missing or failed", () => {
    expect(checkElevationMismatch(terrain, climateAt(null))).toBeNull();
    expect(checkElevationMismatch(SAMPLE_FAILED.sources.terrain, climate)).toBeNull();
    expect(checkElevationMismatch(terrain, SAMPLE_FAILED.sources.climate)).toBeNull();
    expect(checkElevationMismatch(null, undefined)).toBeNull();
  });

  it("treats a grid cell at sea level as a real zero", () => {
    expect(checkElevationMismatch(terrain, climateAt(0))?.differenceMeters).toBe(1234);
  });
});

describe("toHttpUrl", () => {
  it("accepts http and https addresses", () => {
    expect(toHttpUrl("https://example.com/docs")).toBe("https://example.com/docs");
    expect(toHttpUrl("http://example.com")).toBe("http://example.com/");
  });

  it("refuses anything that is not a web address", () => {
    expect(toHttpUrl("javascript:alert(1)")).toBeNull();
    expect(toHttpUrl("data:text/html,x")).toBeNull();
    expect(toHttpUrl("not a url")).toBeNull();
    expect(toHttpUrl("")).toBeNull();
    expect(toHttpUrl(null)).toBeNull();
  });
});
