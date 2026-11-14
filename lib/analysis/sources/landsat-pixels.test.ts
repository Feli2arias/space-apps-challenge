import { describe, expect, it } from "vitest";

import { SourceError } from "../errors";
import { buildWindowUrl, decodeWindowTiff, windowBounds } from "./landsat-pixels";
import {
  fixtureBytes,
  fixtureJson,
  fixtureScene,
  SCENE_ID,
  windowFixtureName,
} from "./landsat-test-fixtures";

const WINDOW_16N = { column: 1269, row: 797, width: 8, height: 8 } as const;
const WINDOW_17N = { column: 176, row: 6115, width: 8, height: 7 } as const;

describe("windowBounds", () => {
  it("puts the window on pixel boundaries of the scene's grid", () => {
    const scene = fixtureScene(SCENE_ID.clear16);
    const bounds = windowBounds(scene.grid, WINDOW_16N);
    expect(bounds).toEqual({ minX: 749055, minY: 1211265, maxX: 749295, maxY: 1211505 });
    expect((bounds.minX - scene.grid.originX) % scene.grid.pixelSize).toBe(0);
  });
});

describe("buildWindowUrl", () => {
  it("builds the request the fixture was captured with", () => {
    expect(buildWindowUrl(fixtureScene(SCENE_ID.clear16), WINDOW_16N)).toBe(
      "https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/749055,1211265,749295,1211505/8x8.tif" +
        "?collection=landsat-c2-l2&item=LC09_L2SP_015053_20251210_02_T1" +
        "&assets=red&assets=nir08&assets=qa_pixel&asset_as_band=true" +
        "&coord_crs=epsg%3A32616&dst_crs=epsg%3A32616&resampling=nearest&return_mask=false",
    );
  });

  it("uses the coordinate system of each scene", () => {
    const url = buildWindowUrl(fixtureScene(SCENE_ID.clear17), WINDOW_17N);
    expect(url).toContain("/bbox/93165,1212855,93405,1213065/8x7.tif");
    expect(url).toContain("coord_crs=epsg%3A32617&dst_crs=epsg%3A32617");
  });
});

describe("decodeWindowTiff", () => {
  it("returns the three bands of a real answer, row by row", async () => {
    const scene = fixtureScene(SCENE_ID.clear16);
    const pixels = await decodeWindowTiff(fixtureBytes(windowFixtureName(scene.id)), scene, WINDOW_16N);
    expect(pixels.width).toBe(8);
    expect(pixels.height).toBe(8);
    expect(pixels.red).toHaveLength(64);
    expect(pixels.nir).toHaveLength(64);
    expect(pixels.qa).toHaveLength(64);
  });

  it("holds, at the plot's centre, the values the service returns for that point", async () => {
    // Two independent routes to the same pixel: our window arithmetic and the
    // service's own /item/point lookup. Checked on both UTM grids.
    for (const [id, window, index] of [
      [SCENE_ID.clear16, WINDOW_16N, 28],
      [SCENE_ID.clear17, WINDOW_17N, 27],
    ] as const) {
      const scene = fixtureScene(id);
      const pixels = await decodeWindowTiff(fixtureBytes(windowFixtureName(id)), scene, window);
      const point = fixtureJson(`landsat-point-${id}.json`) as { values: number[]; band_names: string[] };
      expect(point.band_names).toEqual(["red", "nir08", "qa_pixel"]);
      expect([pixels.red[index], pixels.nir[index], pixels.qa[index]]).toEqual(point.values);
    }
  });

  it("reads fill pixels as stored: zero reflectance bands and the fill bit", async () => {
    const scene = fixtureScene(SCENE_ID.cloudy);
    const corner = { column: 0, row: 0, width: 4, height: 4 };
    const pixels = await decodeWindowTiff(fixtureBytes("landsat-window-fill-corner.tif"), scene, corner);
    expect(Array.from(pixels.red)).toEqual(new Array(16).fill(0));
    expect(Array.from(pixels.nir)).toEqual(new Array(16).fill(0));
    expect(Array.from(pixels.qa)).toEqual(new Array(16).fill(1));
  });

  it("rejects an answer that is not the window requested", async () => {
    const scene = fixtureScene(SCENE_ID.clear16);
    const bytes = fixtureBytes(windowFixtureName(scene.id));
    const shifted = { ...WINDOW_16N, column: WINDOW_16N.column + 1 };
    await expect(decodeWindowTiff(bytes, scene, shifted)).rejects.toMatchObject({ code: "bad-response" });
    const smaller = { ...WINDOW_16N, width: 7 };
    await expect(decodeWindowTiff(bytes.slice(0), scene, smaller)).rejects.toMatchObject({ code: "bad-response" });
  });

  it("rejects a resampled crop: its pixels are not the scene's 30 m pixels", async () => {
    // landsat-crop-utm16.tif is what POST /item/crop returns for a GeoJSON
    // polygon: a 7 × 7 grid of 28.3 m cells, not aligned with the scene.
    const scene = fixtureScene(SCENE_ID.cloudy);
    const window = { column: 1289, row: 797, width: 7, height: 7 };
    await expect(decodeWindowTiff(fixtureBytes("landsat-crop-utm16.tif"), scene, window)).rejects.toBeInstanceOf(
      SourceError,
    );
  });

  it("rejects bytes that are not a GeoTIFF", async () => {
    const scene = fixtureScene(SCENE_ID.clear16);
    const notATiff = new TextEncoder().encode('{"detail":"No item found"}').buffer as ArrayBuffer;
    await expect(decodeWindowTiff(notATiff, scene, WINDOW_16N)).rejects.toMatchObject({ code: "bad-response" });
    await expect(decodeWindowTiff(new ArrayBuffer(0), scene, WINDOW_16N)).rejects.toMatchObject({
      code: "bad-response",
    });
  });
});
