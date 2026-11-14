import { fromArrayBuffer } from "geotiff";
import { describe, expect, it } from "vitest";

import type { Position } from "../types";
import { fixtureBytes } from "./landsat-test-fixtures";
import { toUtm, utmZoneFromEpsg } from "./landsat-utm";
import type { UtmZone } from "./landsat-utm";

/**
 * The reference values are real: landsat-crop-utm16.tif and -utm17.tif are
 * crops the Planetary Computer returned for this same rectangle after
 * reprojecting it (with PROJ) into EPSG:32616 and EPSG:32617. Their bounding
 * boxes are the projected rectangle.
 */
const CORNERS: readonly Position[] = [
  [-84.7209, 10.9491],
  [-84.7191, 10.9491],
  [-84.7191, 10.9509],
  [-84.7209, 10.9509],
];
const ONE_MILLIMETRE = 0.001;

async function serverBoundingBox(fixture: string): Promise<readonly number[]> {
  const tiff = await fromArrayBuffer(fixtureBytes(fixture));
  return (await tiff.getImage(0)).getBoundingBox();
}

function projectedBoundingBox(zone: UtmZone): readonly number[] {
  const points = CORNERS.map((corner) => toUtm(corner, zone));
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

describe("toUtm", () => {
  it("matches the server's reprojection in the plot's own zone (16N)", async () => {
    const expected = await serverBoundingBox("landsat-crop-utm16.tif");
    const actual = projectedBoundingBox({ zone: 16, hemisphere: "north" });
    actual.forEach((value, index) => expect(Math.abs(value - expected[index])).toBeLessThan(ONE_MILLIMETRE));
  });

  it("matches the server's reprojection in the neighbouring zone (17N), 6.7 degrees off its central meridian", async () => {
    const expected = await serverBoundingBox("landsat-crop-utm17.tif");
    const actual = projectedBoundingBox({ zone: 17, hemisphere: "north" });
    actual.forEach((value, index) => expect(Math.abs(value - expected[index])).toBeLessThan(ONE_MILLIMETRE));
  });

  it("puts the central meridian on the false easting and the equator on zero", () => {
    // Zone 16 is centred on 87° W.
    const point = toUtm([-87, 0], { zone: 16, hemisphere: "north" });
    expect(point.x).toBeCloseTo(500_000, 6);
    expect(point.y).toBeCloseTo(0, 6);
  });

  it("adds the 10,000 km false northing in southern zones", () => {
    const position: Position = [-87, -10];
    const north = toUtm(position, { zone: 16, hemisphere: "north" });
    const south = toUtm(position, { zone: 16, hemisphere: "south" });
    expect(north.y).toBeLessThan(0);
    expect(south.y - north.y).toBeCloseTo(10_000_000, 6);
    expect(south.x).toBe(north.x);
  });
});

describe("utmZoneFromEpsg", () => {
  it("reads northern and southern WGS 84 / UTM codes", () => {
    expect(utmZoneFromEpsg(32616)).toEqual({ zone: 16, hemisphere: "north" });
    expect(utmZoneFromEpsg(32601)).toEqual({ zone: 1, hemisphere: "north" });
    expect(utmZoneFromEpsg(32660)).toEqual({ zone: 60, hemisphere: "north" });
    expect(utmZoneFromEpsg(32721)).toEqual({ zone: 21, hemisphere: "south" });
  });

  it("returns null for anything that is not WGS 84 / UTM", () => {
    // 3031 is the polar stereographic system used for Antarctic Landsat scenes.
    for (const code of [3031, 4326, 32600, 32661, 32700, 32761, 32616.5, Number.NaN]) {
      expect(utmZoneFromEpsg(code)).toBeNull();
    }
  });
});
