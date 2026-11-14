import { describe, expect, it } from "vitest";

import { bufferArea, polygonArea } from "../geometry";
import { fixtureScene, SCENE_ID, TEST_AREA } from "./landsat-test-fixtures";
import type { SceneWindowPlan } from "./landsat-window";
import { MIN_PIXELS_FOR_PARCEL, planSceneWindow } from "./landsat-window";

function planFor(area: Parameters<typeof planSceneWindow>[0], sceneId: string): SceneWindowPlan {
  const result = planSceneWindow(area, fixtureScene(sceneId));
  if (!result.ok) throw new Error(result.reason);
  return result.plan;
}

describe("planSceneWindow", () => {
  it("selects the pixels whose centre is inside a 200 m square (zone 16N grid)", () => {
    const plan = planFor(TEST_AREA, SCENE_ID.clear16);
    expect(plan.mode).toBe("parcel");
    expect(plan.window).toEqual({ column: 1269, row: 797, width: 8, height: 8 });
    // 4 ha at 0.09 ha per pixel is 44.4 pixels; 43 centres fall inside.
    expect(plan.totalPixels).toBe(43);
    expect(plan.inside.filter(Boolean)).toHaveLength(43);
    expect(plan.inside).toHaveLength(64);
    // The outer ring of the window only touches the square; its centres are outside.
    expect(plan.inside[0]).toBe(false);
    expect(plan.inside[1]).toBe(true);
  });

  it("uses the scene's own zone: the same square is 49 pixels on the zone 17N grid", () => {
    const plan = planFor(TEST_AREA, SCENE_ID.clear17);
    expect(plan.window).toEqual({ column: 176, row: 6115, width: 8, height: 7 });
    expect(plan.totalPixels).toBe(49);
  });

  it("switches to the pixel under the centre when the area is about one pixel", () => {
    const tiny = bufferArea({ lat: 10.95, lon: -84.72 }, 20);
    const plan = planFor(tiny, SCENE_ID.clear16);
    expect(plan).toEqual({
      mode: "pixel",
      window: { column: 1273, row: 800, width: 1, height: 1 },
      inside: [true],
      totalPixels: 1,
    });
  });

  it("places the centre pixel at index 28 of the parcel window", () => {
    // landsat-pixels.test.ts checks that this index holds the values the
    // service's own /item/point lookup returns for the centre of the plot.
    const parcel = planFor(TEST_AREA, SCENE_ID.clear16);
    const single = planFor(bufferArea({ lat: 10.95, lon: -84.72 }, 20), SCENE_ID.clear16);
    if (!parcel.window || !single.window) throw new Error("no window");
    const index =
      (single.window.row - parcel.window.row) * parcel.window.width +
      (single.window.column - parcel.window.column);
    expect(index).toBe(28);
    expect(parcel.inside[index]).toBe(true);
  });

  it("counts every pixel of a larger polygon once", () => {
    // 600 m × 300 m: 18 ha, 200 pixels of 0.09 ha.
    const plan = planFor(
      polygonArea([
        [-84.7227, 10.9487],
        [-84.7172, 10.9487],
        [-84.7172, 10.9514],
        [-84.7227, 10.9514],
      ]),
      SCENE_ID.clear16,
    );
    expect(plan.mode).toBe("parcel");
    expect(plan.totalPixels).toBeGreaterThanOrEqual(190);
    expect(plan.totalPixels).toBeLessThanOrEqual(210);
    expect(plan.inside.filter(Boolean)).toHaveLength(plan.totalPixels);
  });

  it("keeps counting the pixels that fall outside the raster, and reads only what exists", () => {
    const scene = fixtureScene(SCENE_ID.clear16);
    // A raster cut so that only the first three columns of the window exist.
    const narrow = { ...scene, grid: { ...scene.grid, columns: 1272 } };
    const result = planSceneWindow(TEST_AREA, narrow);
    if (!result.ok) throw new Error(result.reason);
    expect(result.plan.totalPixels).toBe(43);
    expect(result.plan.window).toEqual({ column: 1269, row: 797, width: 3, height: 8 });
    expect(result.plan.inside.filter(Boolean).length).toBeLessThan(43);
  });

  it("returns no window when the area is wholly outside the raster", () => {
    const scene = fixtureScene(SCENE_ID.clear16);
    const elsewhere = { ...scene, grid: { ...scene.grid, columns: 100 } };
    const result = planSceneWindow(TEST_AREA, elsewhere);
    if (!result.ok) throw new Error(result.reason);
    expect(result.plan).toMatchObject({ window: null, inside: [], totalPixels: 43 });
  });

  it("refuses a coordinate system that is not UTM", () => {
    const scene = { ...fixtureScene(SCENE_ID.clear16), epsg: 3031 };
    expect(planSceneWindow(TEST_AREA, scene)).toEqual({ ok: false, reason: "unsupported-projection" });
  });

  it("refuses an outline wider than the largest window", () => {
    // A strip 20 km long and a few metres wide.
    const strip = polygonArea([
      [-84.8, 10.95],
      [-84.6, 10.95],
      [-84.6, 10.95005],
      [-84.8, 10.95005],
    ]);
    expect(planSceneWindow(strip, fixtureScene(SCENE_ID.clear16))).toEqual({ ok: false, reason: "area-too-wide" });
  });

  it("names the threshold between pixel and parcel", () => {
    expect(MIN_PIXELS_FOR_PARCEL).toBe(2);
  });
});
