import { describe, expect, it } from "vitest";

import type { VegetationObservation } from "../types";
import { computeNdviStats } from "./landsat-ndvi";
import { decodeWindowTiff } from "./landsat-pixels";
import { buildRejectMask } from "./landsat-qa";
import {
  aggregateMonthly,
  capPeriod,
  isUsable,
  keepOnePerDate,
  LOW_VEGETATION_NDVI,
  meanNdvi,
  MIN_CLEAR_FRACTION,
  toObservation,
} from "./landsat-series";
import { fixtureBytes, fixtureScene, SCENE_ID, TEST_AREA, windowFixtureName } from "./landsat-test-fixtures";
import { planSceneWindow } from "./landsat-window";

/** The observation the source would build from a captured scene. */
async function observationOf(sceneId: string): Promise<VegetationObservation> {
  const scene = fixtureScene(sceneId);
  const planned = planSceneWindow(TEST_AREA, scene);
  const rejectMask = buildRejectMask(scene.qaBitfields);
  if (!planned.ok || !planned.plan.window || rejectMask === null) throw new Error("Unusable fixture.");
  const { window, inside, totalPixels } = planned.plan;
  const pixels = await decodeWindowTiff(fixtureBytes(windowFixtureName(sceneId)), scene, window);
  const stats = computeNdviStats({ pixels, inside, red: scene.red, nir: scene.nir, rejectMask });
  return toObservation(scene, stats, totalPixels);
}

/** A short-hand observation for the aggregation edge cases. */
function observation(date: string, ndviMean: number | null, overrides: Partial<VegetationObservation> = {}): VegetationObservation {
  const usable = ndviMean !== null;
  return {
    date,
    sceneId: `scene-${date}`,
    platform: "landsat-9",
    ndviMean,
    ndviMin: ndviMean,
    ndviMax: ndviMean,
    clearPixels: usable ? 43 : 0,
    totalPixels: 43,
    sceneCloudCover: null,
    usable,
    ...overrides,
  };
}

describe("isUsable", () => {
  it("needs at least three quarters of the area clear", () => {
    expect(MIN_CLEAR_FRACTION).toBe(0.75);
    expect(isUsable(43, 43)).toBe(true);
    expect(isUsable(33, 43)).toBe(true); // 0.767
    expect(isUsable(32, 43)).toBe(false); // 0.744
    expect(isUsable(3, 4)).toBe(true); // exactly 0.75
    expect(isUsable(0, 43)).toBe(false);
  });

  it("is never usable without pixels", () => {
    expect(isUsable(0, 0)).toBe(false);
  });
});

describe("toObservation on captured scenes", () => {
  it("clear scene: usable, with the scene's metadata and rounded NDVI", async () => {
    expect(await observationOf(SCENE_ID.clear16)).toEqual({
      date: "2025-12-10",
      sceneId: SCENE_ID.clear16,
      platform: "landsat-9",
      ndviMean: 0.8538,
      ndviMin: 0.761,
      ndviMax: 0.9306,
      clearPixels: 43,
      totalPixels: 43,
      sceneCloudCover: 69.75,
      usable: true,
    });
  });

  it("partly cloudy scene: 24 of 43 pixels clear is not enough, but the numbers are kept", async () => {
    const partly = await observationOf(SCENE_ID.partlyCloudy);
    expect(partly).toMatchObject({ clearPixels: 24, totalPixels: 43, usable: false, ndviMean: 0.8173 });
  });

  it("cloudy scene: zero clear pixels and null NDVI, never zero", async () => {
    const cloudy = await observationOf(SCENE_ID.cloudy);
    expect(cloudy).toMatchObject({ clearPixels: 0, usable: false, ndviMean: null, ndviMin: null, ndviMax: null });
  });
});

describe("keepOnePerDate", () => {
  it("counts two scenes of the same satellite pass once", async () => {
    const zone16 = await observationOf(SCENE_ID.clear16);
    const zone17 = await observationOf(SCENE_ID.clear17);
    expect(zone16.date).toBe(zone17.date);
    // Both are fully clear and differ by 0.02 NDVI: the same look at the plot.
    expect(Math.abs((zone16.ndviMean ?? 0) - (zone17.ndviMean ?? 0))).toBeLessThan(0.03);

    const { kept, setAside } = keepOnePerDate([zone16, zone17]);
    expect(setAside).toBe(1);
    expect(kept).toHaveLength(1);
    // Equally clear: the lower scene id is kept, whatever the input order.
    expect(kept[0].sceneId).toBe(SCENE_ID.clear17);
    expect(keepOnePerDate([zone17, zone16]).kept[0].sceneId).toBe(SCENE_ID.clear17);
  });

  it("prefers the scene where more of the area is clear", async () => {
    const clear = await observationOf(SCENE_ID.clear16);
    const cloudyTwin = { ...(await observationOf(SCENE_ID.cloudy)), date: clear.date, sceneId: "AAA" };
    const { kept, setAside } = keepOnePerDate([cloudyTwin, clear]);
    expect(setAside).toBe(1);
    expect(kept[0].sceneId).toBe(SCENE_ID.clear16);
  });

  it("compares the clear share, not the pixel count, across different grids", () => {
    const fewer = observation("2025-01-01", 0.5, { sceneId: "B", clearPixels: 40, totalPixels: 43 });
    const more = observation("2025-01-01", 0.5, { sceneId: "A", clearPixels: 42, totalPixels: 49 });
    // 40/43 = 0.93 beats 42/49 = 0.86.
    expect(keepOnePerDate([more, fewer]).kept[0].sceneId).toBe("B");
  });

  it("leaves different dates alone and returns them oldest first", async () => {
    const observations = await Promise.all(
      [SCENE_ID.clear16, SCENE_ID.cloudy, SCENE_ID.partlyCloudy].map(observationOf),
    );
    const { kept, setAside } = keepOnePerDate(observations);
    expect(setAside).toBe(0);
    expect(kept.map((entry) => entry.date)).toEqual(["2025-02-25", "2025-03-29", "2025-12-10"]);
  });

  it("handles an empty list", () => {
    expect(keepOnePerDate([])).toEqual({ kept: [], setAside: 0 });
  });
});

describe("aggregateMonthly", () => {
  const period = { start: "2025-01-01", end: "2025-12-31" };

  it("summarises captured scenes by month and keeps the empty months", async () => {
    const all = await Promise.all(
      [SCENE_ID.clear16, SCENE_ID.clear17, SCENE_ID.partlyCloudy, SCENE_ID.cloudy].map(observationOf),
    );
    const monthly = aggregateMonthly(keepOnePerDate(all).kept, period);
    expect(monthly).toHaveLength(12);
    expect(monthly[0]).toEqual({ year: 2025, month: 1, ndviMean: null, usableObservations: 0, totalObservations: 0 });
    // February and March were observed, but never clearly enough.
    expect(monthly[1]).toEqual({ year: 2025, month: 2, ndviMean: null, usableObservations: 0, totalObservations: 1 });
    expect(monthly[2]).toEqual({ year: 2025, month: 3, ndviMean: null, usableObservations: 0, totalObservations: 1 });
    expect(monthly[11]).toEqual({ year: 2025, month: 12, ndviMean: 0.8336, usableObservations: 1, totalObservations: 1 });
  });

  it("averages only the usable observations of a month", () => {
    const monthly = aggregateMonthly(
      [observation("2025-03-02", 0.4), observation("2025-03-18", 0.6), observation("2025-03-26", null)],
      { start: "2025-03-01", end: "2025-03-31" },
    );
    expect(monthly).toEqual([{ year: 2025, month: 3, ndviMean: 0.5, usableObservations: 2, totalObservations: 3 }]);
  });

  it("keeps a real zero apart from a missing month", () => {
    const monthly = aggregateMonthly([observation("2025-01-10", 0)], { start: "2025-01-01", end: "2025-02-28" });
    expect(monthly[0].ndviMean).toBe(0);
    expect(monthly[1].ndviMean).toBeNull();
  });

  it("does not let an unusable observation with numbers leak into the mean", () => {
    const partly = observation("2025-05-05", 0.9, { usable: false, clearPixels: 10 });
    const monthly = aggregateMonthly([partly], { start: "2025-05-01", end: "2025-05-31" });
    expect(monthly[0]).toMatchObject({ ndviMean: null, usableObservations: 0, totalObservations: 1 });
  });

  it("covers every month across years, in order", () => {
    const monthly = aggregateMonthly([], { start: "2023-11-01", end: "2024-02-29" });
    expect(monthly.map((month) => `${month.year}-${month.month}`)).toEqual(["2023-11", "2023-12", "2024-1", "2024-2"]);
    expect(monthly.every((month) => month.ndviMean === null && month.totalObservations === 0)).toBe(true);
  });
});

describe("meanNdvi", () => {
  it("is the mean of the usable observations, null when there is none", () => {
    expect(meanNdvi([observation("2025-01-01", 0.2), observation("2025-02-01", 0.8), observation("2025-03-01", null)])).toBe(0.5);
    expect(meanNdvi([observation("2025-03-01", null)])).toBeNull();
    expect(meanNdvi([])).toBeNull();
  });
});

describe("capPeriod", () => {
  it("keeps the most recent months of a longer period", () => {
    expect(capPeriod({ start: "2021-01-01", end: "2025-12-31" }, 36)).toEqual({
      period: { start: "2023-01-01", end: "2025-12-31" },
      capped: true,
    });
    expect(capPeriod({ start: "2016-01-01", end: "2025-12-31" }, 24)).toEqual({
      period: { start: "2024-01-01", end: "2025-12-31" },
      capped: true,
    });
  });

  it("leaves a period of exactly the cap, or shorter, untouched", () => {
    const threeYears = { start: "2023-01-01", end: "2025-12-31" };
    expect(capPeriod(threeYears, 36)).toEqual({ period: threeYears, capped: false });
    const oneYear = { start: "2025-01-01", end: "2025-12-31" };
    expect(capPeriod(oneYear, 36)).toEqual({ period: oneYear, capped: false });
  });

  it("handles periods that do not end on the last day of a year", () => {
    expect(capPeriod({ start: "2020-01-01", end: "2025-06-30" }, 12).period.start).toBe("2024-07-01");
    expect(capPeriod({ start: "2020-01-01", end: "2025-03-30" }, 1).period.start).toBe("2025-02-28");
  });
});

describe("LOW_VEGETATION_NDVI", () => {
  it("is the lower end of the range USGS gives for sparse vegetation", () => {
    expect(LOW_VEGETATION_NDVI).toBe(0.2);
  });
});
