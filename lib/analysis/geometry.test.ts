import { describe, expect, it } from "vitest";
import {
  bboxOfRing,
  bufferArea,
  centroidOfRing,
  closeRing,
  fromLocalMeters,
  gridOverBbox,
  isPointInRing,
  isSelfIntersecting,
  metersPerDegree,
  polygonArea,
  ringAreaHectares,
  squareAround,
  toLocalMeters,
} from "./geometry";
import type { LatLon, Position } from "./types";

const LOS_CHILES: LatLon = { lat: 10.95, lon: -84.72 };

describe("metersPerDegree", () => {
  it("gives about 111 km per degree of latitude everywhere", () => {
    expect(metersPerDegree(0).lat).toBeCloseTo(111_195, -1);
    expect(metersPerDegree(60).lat).toBeCloseTo(111_195, -1);
  });

  it("shrinks a degree of longitude away from the equator", () => {
    expect(metersPerDegree(0).lon).toBeCloseTo(111_195, -1);
    expect(metersPerDegree(60).lon).toBeCloseTo(111_195 / 2, -1);
  });
});

describe("local projection", () => {
  it("round-trips a position", () => {
    const position: Position = [-84.7185, 10.9512];
    const back = fromLocalMeters(toLocalMeters(position, LOS_CHILES), LOS_CHILES);
    expect(back[0]).toBeCloseTo(position[0], 10);
    expect(back[1]).toBeCloseTo(position[1], 10);
  });
});

describe("closeRing", () => {
  it("repeats the first position at the end", () => {
    expect(closeRing([[0, 0], [1, 0], [1, 1]])).toEqual([[0, 0], [1, 0], [1, 1], [0, 0]]);
  });

  it("leaves an already closed ring unchanged", () => {
    const ring: Position[] = [[0, 0], [1, 0], [1, 1], [0, 0]];
    expect(closeRing(ring)).toBe(ring);
  });

  it("returns an empty ring for no positions", () => {
    expect(closeRing([])).toEqual([]);
  });
});

describe("squareAround", () => {
  it("builds a closed square with the requested side", () => {
    const ring = squareAround(LOS_CHILES, 200);
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]);
    const west = toLocalMeters(ring[0], LOS_CHILES);
    const east = toLocalMeters(ring[1], LOS_CHILES);
    expect(east.x - west.x).toBeCloseTo(200, 6);
  });

  it("has the area of its side squared", () => {
    expect(ringAreaHectares(squareAround(LOS_CHILES, 200))).toBeCloseTo(4, 3);
    expect(ringAreaHectares(squareAround(LOS_CHILES, 100))).toBeCloseTo(1, 3);
  });
});

describe("ringAreaHectares", () => {
  it("does not depend on the direction of the ring", () => {
    const ring = squareAround(LOS_CHILES, 300);
    expect(ringAreaHectares([...ring].reverse())).toBeCloseTo(ringAreaHectares(ring), 9);
  });

  it("is zero for fewer than three different points", () => {
    expect(ringAreaHectares([[0, 0], [1, 1]])).toBe(0);
    expect(ringAreaHectares([])).toBe(0);
  });
});

describe("centroidOfRing", () => {
  it("is the centre of a square", () => {
    const centroid = centroidOfRing(squareAround(LOS_CHILES, 500));
    expect(centroid.lat).toBeCloseTo(LOS_CHILES.lat, 8);
    expect(centroid.lon).toBeCloseTo(LOS_CHILES.lon, 8);
  });

  it("falls back to the bounding-box centre for a line", () => {
    const centroid = centroidOfRing([[0, 0], [2, 0], [0, 0]]);
    expect(centroid).toEqual({ lat: 0, lon: 1 });
  });
});

describe("isPointInRing", () => {
  const ring = squareAround(LOS_CHILES, 200);

  it("accepts the centre and rejects a point outside", () => {
    expect(isPointInRing([LOS_CHILES.lon, LOS_CHILES.lat], ring)).toBe(true);
    expect(isPointInRing([LOS_CHILES.lon + 0.01, LOS_CHILES.lat], ring)).toBe(false);
  });

  it("handles a concave outline", () => {
    // An "L" shape: the notch at the top right is outside.
    const shape: Position[] = [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]];
    expect(isPointInRing([0.5, 1.5], shape)).toBe(true);
    expect(isPointInRing([1.5, 1.5], shape)).toBe(false);
  });
});

describe("isSelfIntersecting", () => {
  it("is false for a simple outline", () => {
    expect(isSelfIntersecting(squareAround(LOS_CHILES, 200))).toBe(false);
    expect(isSelfIntersecting([[0, 0], [1, 0], [0, 1]])).toBe(false);
  });

  it("is true for a bow-tie", () => {
    expect(isSelfIntersecting([[0, 0], [1, 1], [1, 0], [0, 1]])).toBe(true);
  });
});

describe("bufferArea and polygonArea", () => {
  it("describe a point as a square of a stated size", () => {
    const area = bufferArea(LOS_CHILES, 200);
    expect(area.kind).toBe("buffer");
    expect(area.bufferSideMeters).toBe(200);
    expect(area.center).toEqual(LOS_CHILES);
    expect(area.areaHectares).toBeCloseTo(4, 3);
    expect(area.bbox).toEqual(bboxOfRing(area.polygon.coordinates[0]));
  });

  it("close a drawn outline and compute its centre", () => {
    const open = squareAround(LOS_CHILES, 100).slice(0, 4);
    const area = polygonArea(open);
    expect(area.kind).toBe("polygon");
    expect(area.bufferSideMeters).toBeNull();
    expect(area.polygon.coordinates[0]).toHaveLength(5);
    expect(area.center.lat).toBeCloseTo(LOS_CHILES.lat, 8);
  });
});

describe("gridOverBbox", () => {
  const bbox = bboxOfRing(squareAround(LOS_CHILES, 300));

  it("returns rows from north to south and columns from west to east", () => {
    const { points } = gridOverBbox(bbox, 3, 2);
    expect(points).toHaveLength(6);
    expect(points[0]).toEqual([bbox[0], bbox[3]]);
    expect(points[2]).toEqual([bbox[2], bbox[3]]);
    expect(points[5]).toEqual([bbox[2], bbox[1]]);
  });

  it("reports the spacing in metres", () => {
    const { spacingMeters } = gridOverBbox(bbox, 11, 11);
    expect(spacingMeters.x).toBeCloseTo(30, 1);
    expect(spacingMeters.y).toBeCloseTo(30, 1);
  });

  it("reports zero spacing for a single row or column", () => {
    expect(gridOverBbox(bbox, 1, 1).spacingMeters).toEqual({ x: 0, y: 0 });
  });
});
