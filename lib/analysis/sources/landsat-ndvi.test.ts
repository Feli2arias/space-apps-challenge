import { describe, expect, it } from "vitest";

import { computeNdviStats, ndvi, NO_CLEAR_PIXELS, toReflectance, VALID_REFLECTANCE } from "./landsat-ndvi";
import type { NdviStats } from "./landsat-ndvi";
import { decodeWindowTiff } from "./landsat-pixels";
import type { SceneWindowPixels } from "./landsat-pixels";
import { buildRejectMask, isClearQa } from "./landsat-qa";
import type { BandScaling } from "./landsat-stac";
import { fixtureBytes, fixtureScene, SCENE_ID, TEST_AREA, windowFixtureName } from "./landsat-test-fixtures";
import { planSceneWindow } from "./landsat-window";

/** Scale, offset and "no data" as every captured scene publishes them. */
const SCALING: BandScaling = fixtureScene(SCENE_ID.clear16).red;
const REJECT_MASK = 0b111111;
const QA_CLEAR = 21824;
const QA_CLOUD = 22280;

interface FixtureRun {
  readonly stats: NdviStats;
  readonly pixels: SceneWindowPixels;
  readonly inside: readonly boolean[];
  readonly totalPixels: number;
}

/** Runs the real pipeline (plan → decode → statistics) on a captured raster. */
async function statsOfFixture(sceneId: string): Promise<FixtureRun> {
  const scene = fixtureScene(sceneId);
  const planned = planSceneWindow(TEST_AREA, scene);
  if (!planned.ok || !planned.plan.window) throw new Error("The fixture scene could not be planned.");
  const { window, inside, totalPixels } = planned.plan;
  const pixels = await decodeWindowTiff(fixtureBytes(windowFixtureName(sceneId)), scene, window);
  const rejectMask = buildRejectMask(scene.qaBitfields);
  if (rejectMask === null) throw new Error("The fixture scene has no usable bit description.");
  const stats = computeNdviStats({ pixels, inside, red: scene.red, nir: scene.nir, rejectMask });
  return { stats, pixels, inside, totalPixels };
}

/** A hand-sized window for the edge cases; values are stored integers. */
function windowOf(red: readonly number[], nir: readonly number[], qa: readonly number[]): SceneWindowPixels {
  return { width: red.length, height: 1, red, nir, qa };
}

function statsOf(pixels: SceneWindowPixels, inside?: readonly boolean[]): NdviStats {
  return computeNdviStats({
    pixels,
    inside: inside ?? Array.from({ length: pixels.width * pixels.height }, () => true),
    red: SCALING,
    nir: SCALING,
    rejectMask: REJECT_MASK,
  });
}

describe("toReflectance", () => {
  it("applies the scene's scale and offset", () => {
    expect(SCALING).toEqual({ scale: 2.75e-5, offset: -0.2, nodata: 0 });
    // Centre pixel of the clear scene: red 8582, near infrared 22783.
    expect(toReflectance(8582, SCALING)).toBeCloseTo(0.036005, 9);
    expect(toReflectance(22783, SCALING)).toBeCloseTo(0.4265325, 9);
  });

  it("treats the nodata value as missing, not as a reflectance of -0.2", () => {
    expect(toReflectance(0, SCALING)).toBeNull();
  });

  it("accepts exactly the stored range USGS publishes as valid, 7273 to 43636", () => {
    expect(toReflectance(7273, SCALING)).not.toBeNull();
    expect(toReflectance(7272, SCALING)).toBeNull();
    expect(toReflectance(43636, SCALING)).not.toBeNull();
    expect(toReflectance(43637, SCALING)).toBeNull();
    expect(VALID_REFLECTANCE).toEqual({ min: 0, max: 1 });
  });

  it("uses the scaling it is given, not fixed numbers", () => {
    expect(toReflectance(5000, { scale: 0.0001, offset: 0, nodata: -9999 })).toBeCloseTo(0.5, 12);
    expect(toReflectance(-9999, { scale: 0.0001, offset: 0, nodata: -9999 })).toBeNull();
  });
});

describe("ndvi", () => {
  it("is (NIR − Red) / (NIR + Red)", () => {
    expect(ndvi(0.4265325, 0.036005)).toBeCloseTo(0.8443, 4);
    expect(ndvi(0.5, 0.1)).toBeCloseTo(2 / 3, 12);
  });

  it("gives a real zero when both bands are equal", () => {
    expect(ndvi(0.3, 0.3)).toBe(0);
  });

  it("is negative when red is brighter than near infrared", () => {
    expect(ndvi(0.1, 0.3)).toBeCloseTo(-0.5, 12);
  });

  it("is missing, not zero, when both reflectances are zero", () => {
    expect(ndvi(0, 0)).toBeNull();
  });
});

describe("computeNdviStats on synthetic edge cases", () => {
  it("differs from an index computed on the stored integers", () => {
    const stats = statsOf(windowOf([8582], [22783], [QA_CLEAR]));
    const onStoredIntegers = (22783 - 8582) / (22783 + 8582);
    expect(stats.mean).toBeCloseTo(0.8443, 4);
    expect(onStoredIntegers).toBeCloseTo(0.4528, 4);
  });

  it("returns nulls and zero clear pixels for an empty window", () => {
    expect(statsOf({ width: 0, height: 0, red: [], nir: [], qa: [] })).toEqual(NO_CLEAR_PIXELS);
  });

  it("returns nulls when every pixel is masked or missing", () => {
    expect(statsOf(windowOf([20000, 0], [30000, 0], [QA_CLOUD, 1]))).toEqual(NO_CLEAR_PIXELS);
  });

  it("ignores pixels outside the area even when they are clear", () => {
    const pixels = windowOf([8582, 20000], [22783, 20000], [QA_CLEAR, QA_CLEAR]);
    const stats = statsOf(pixels, [true, false]);
    expect(stats.clearPixels).toBe(1);
    expect(stats.mean).toBeCloseTo(0.8443, 4);
  });

  it("keeps a real NDVI of zero and drops missing pixels", () => {
    // First pixel: equal bands, NDVI exactly 0. Second: nodata in red.
    const stats = statsOf(windowOf([20000, 0], [20000, 25000], [QA_CLEAR, QA_CLEAR]));
    expect(stats).toEqual({ mean: 0, min: 0, max: 0, clearPixels: 1 });
  });

  it("drops a clear pixel when either band is outside the valid range", () => {
    const stats = statsOf(windowOf([7000, 20000, 8582], [30000, 50000, 22783], [QA_CLEAR, QA_CLEAR, QA_CLEAR]));
    expect(stats.clearPixels).toBe(1);
  });

  it("reports mean, minimum and maximum of the clear pixels", () => {
    // NDVI 0 (equal bands) and NDVI 2/3 (reflectance 0.1 and 0.5).
    const red = (0.1 + 0.2) / 2.75e-5;
    const nir = (0.5 + 0.2) / 2.75e-5;
    const stats = statsOf(windowOf([20000, red], [20000, nir], [QA_CLEAR, QA_CLEAR]));
    expect(stats.clearPixels).toBe(2);
    expect(stats.min).toBe(0);
    expect(stats.max).toBeCloseTo(2 / 3, 6);
    expect(stats.mean).toBeCloseTo(1 / 3, 6);
  });
});

/**
 * The expected values below were computed independently, by a separate script
 * over the same captured rasters, not by the code under test.
 */
describe("computeNdviStats on captured rasters", () => {
  it("clear scene: all 43 pixels of the plot count", async () => {
    const { stats, totalPixels } = await statsOfFixture(SCENE_ID.clear16);
    expect(totalPixels).toBe(43);
    expect(stats.clearPixels).toBe(43);
    expect(stats.mean).toBeCloseTo(0.8538245933941053, 10);
    expect(stats.min).toBeCloseTo(0.7609707161905339, 10);
    expect(stats.max).toBeCloseTo(0.930618565844141, 10);
  });

  it("same pass on the zone 17N grid: 49 pixels and a close, not identical, mean", async () => {
    const { stats, totalPixels } = await statsOfFixture(SCENE_ID.clear17);
    expect(totalPixels).toBe(49);
    expect(stats.clearPixels).toBe(49);
    expect(stats.mean).toBeCloseTo(0.8336492712992325, 10);
  });

  it("cloudy scene: every pixel is rejected by the quality band", async () => {
    const { stats, pixels, totalPixels } = await statsOfFixture(SCENE_ID.cloudy);
    expect(new Set(Array.from(pixels.qa))).toEqual(new Set([QA_CLOUD]));
    expect(totalPixels).toBe(43);
    expect(stats).toEqual(NO_CLEAR_PIXELS);
  });

  it("partly cloudy scene: 17 pixels masked and 2 more dropped for invalid reflectance", async () => {
    const { stats, pixels, inside, totalPixels } = await statsOfFixture(SCENE_ID.partlyCloudy);
    const clearByQa = inside.filter((isInside, index) => isInside && isClearQa(pixels.qa[index], REJECT_MASK));
    expect(totalPixels).toBe(43);
    expect(clearByQa).toHaveLength(26);
    expect(stats.clearPixels).toBe(24);
    expect(stats.mean).toBeCloseTo(0.8172834738835216, 10);
    expect(stats.min).toBeCloseTo(0.619034176832342, 10);
    expect(stats.max).toBeCloseTo(0.9111979239333649, 10);
  });

  it("Tier 2 scene: a cloud reported as clear gives an NDVI near zero", async () => {
    // This is why Tier 2 scenes are not used: the same pass, delivered as a
    // Tier 1 scene of the next row, reports the plot fully cloudy.
    const { stats, pixels } = await statsOfFixture(SCENE_ID.tier2);
    expect(new Set(Array.from(pixels.qa))).toEqual(new Set([QA_CLEAR]));
    expect(stats.clearPixels).toBe(49);
    expect(stats.mean).toBeCloseTo(0.004456078215721158, 10);
    // Reflectance above 0.9 in the red band: a cloud top, not a field.
    expect(toReflectance(pixels.red[0], SCALING)).toBeGreaterThan(0.9);
  });
});
