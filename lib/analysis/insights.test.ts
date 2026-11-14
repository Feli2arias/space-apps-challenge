import { describe, expect, it } from "vitest";
import { rainCoverInsight } from "./insights";
import type { RainData, VegetationData, VegetationObservation } from "./types";

/** Rain concentrated from May to October: 200 mm in those months, 20 mm in the rest. */
function rain(overrides: Partial<Record<number, number | null>> = {}): RainData {
  return {
    monthly: [],
    annual: [],
    climatology: Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const base = month >= 5 && month <= 10 ? 200 : 20;
      const meanMm = month in overrides ? (overrides[month] ?? null) : base;
      return { month, meanMm, minMm: meanMm, maxMm: meanMm, years: 5 };
    }),
  };
}

function observation(date: string, ndviMean: number | null, usable = true): VegetationObservation {
  return {
    date,
    sceneId: `scene-${date}`,
    platform: "landsat-8",
    ndviMean,
    ndviMin: ndviMean,
    ndviMax: ndviMean,
    clearPixels: usable ? 40 : 0,
    totalPixels: 40,
    sceneCloudCover: 10,
    usable,
  };
}

function vegetation(observations: VegetationObservation[]): VegetationData {
  return {
    observations,
    monthly: [],
    lowVegetationThreshold: 0.2,
    minClearFraction: 0.5,
    pixelsInArea: 40,
  };
}

describe("rainCoverInsight", () => {
  it("needs both sources", () => {
    expect(rainCoverInsight(null, vegetation([]))).toBeNull();
    expect(rainCoverInsight(rain(), null)).toBeNull();
  });

  it("flags a rainy month in which most clear scenes show low vegetation", () => {
    const insight = rainCoverInsight(
      rain(),
      vegetation([observation("2024-06-03", 0.12), observation("2025-06-19", 0.15)]),
    );
    expect(insight?.coincidingMonths).toEqual([6]);
    const june = insight?.months[5];
    expect(june?.lowVegetationShare).toBe(1);
    expect(june?.rainierThanAverage).toBe(true);
    expect(june?.rainOnLowCover).toBe(true);
  });

  it("does not flag a rainy month with healthy vegetation", () => {
    const insight = rainCoverInsight(
      rain(),
      vegetation([observation("2024-06-03", 0.6), observation("2025-06-19", 0.7)]),
    );
    expect(insight?.months[5].rainOnLowCover).toBe(false);
    expect(insight?.coincidingMonths).toEqual([]);
  });

  it("never flags a dry month, even with bare ground or no scenes", () => {
    const insight = rainCoverInsight(
      rain(),
      vegetation([observation("2024-02-03", 0.1), observation("2025-02-19", 0.1)]),
    );
    expect(insight?.months[1].rainOnLowCover).toBe(false);
    expect(insight?.months[0].rainOnLowCover).toBe(false);
  });

  it("says a rainy month is unknown when there are too few clear scenes", () => {
    const insight = rainCoverInsight(rain(), vegetation([observation("2024-09-03", 0.1)]));
    const september = insight?.months[8];
    expect(september?.usableObservations).toBe(1);
    expect(september?.lowVegetationShare).toBeNull();
    expect(september?.rainOnLowCover).toBeNull();
    expect(insight?.unknownMonths).toEqual([5, 6, 7, 8, 9, 10]);
  });

  it("ignores scenes that were not usable", () => {
    const insight = rainCoverInsight(
      rain(),
      vegetation([observation("2024-06-03", null, false), observation("2025-06-19", 0.1, false)]),
    );
    expect(insight?.months[5].usableObservations).toBe(0);
    expect(insight?.months[5].rainOnLowCover).toBeNull();
  });

  it("requires a majority of low-vegetation scenes", () => {
    const insight = rainCoverInsight(
      rain(),
      vegetation([
        observation("2023-07-01", 0.1),
        observation("2024-07-01", 0.5),
        observation("2025-07-01", 0.6),
      ]),
    );
    expect(insight?.months[6].lowVegetationShare).toBeCloseTo(1 / 3, 6);
    expect(insight?.months[6].rainOnLowCover).toBe(false);
  });

  it("reports the share of annual rain that falls in the coinciding months", () => {
    const insight = rainCoverInsight(
      rain(),
      vegetation([observation("2024-06-03", 0.1), observation("2025-06-19", 0.1)]),
    );
    // 200 mm of June over 6 × 200 + 6 × 20 = 1320 mm a year.
    expect(insight?.rainShareInCoincidingMonths).toBeCloseTo(200 / 1320, 6);
  });

  it("keeps missing rainfall as unknown instead of treating it as dry", () => {
    const insight = rainCoverInsight(
      rain({ 6: null }),
      vegetation([observation("2024-06-03", 0.1), observation("2025-06-19", 0.1)]),
    );
    expect(insight?.months[5].meanRainMm).toBeNull();
    expect(insight?.months[5].rainOnLowCover).toBeNull();
    expect(insight?.rainShareInCoincidingMonths).toBeNull();
  });

  it("treats a month with zero rain as a real, dry month", () => {
    const insight = rainCoverInsight(rain({ 1: 0 }), vegetation([]));
    expect(insight?.months[0].meanRainMm).toBe(0);
    expect(insight?.months[0].rainierThanAverage).toBe(false);
  });
});
