import type { AnalysisArea, BoundingBox, LatLon, PolygonGeometry, Position, Ring } from "./types";

/**
 * Geometry for areas the size of a farm plot. Distances and areas use a local
 * flat projection around the area itself, which is accurate to well under 1%
 * for anything smaller than a few kilometres.
 */

const EARTH_RADIUS_METERS = 6_371_008.8;
const METERS_PER_DEGREE_LATITUDE = (Math.PI / 180) * EARTH_RADIUS_METERS;
const SQUARE_METERS_PER_HECTARE = 10_000;

export interface LocalPoint {
  /** Metres east of the origin. */
  readonly x: number;
  /** Metres north of the origin. */
  readonly y: number;
}

/** Length in metres of one degree of latitude and of longitude at a given latitude. */
export function metersPerDegree(latitude: number): { readonly lat: number; readonly lon: number } {
  return {
    lat: METERS_PER_DEGREE_LATITUDE,
    lon: METERS_PER_DEGREE_LATITUDE * Math.cos((latitude * Math.PI) / 180),
  };
}

/** Projects a position to metres east and north of `origin`. */
export function toLocalMeters(position: Position, origin: LatLon): LocalPoint {
  const scale = metersPerDegree(origin.lat);
  return {
    x: (position[0] - origin.lon) * scale.lon,
    y: (position[1] - origin.lat) * scale.lat,
  };
}

/** Inverse of `toLocalMeters`. */
export function fromLocalMeters(point: LocalPoint, origin: LatLon): Position {
  const scale = metersPerDegree(origin.lat);
  return [origin.lon + point.x / scale.lon, origin.lat + point.y / scale.lat];
}

/** Returns the ring with its first position repeated at the end, without duplicating it. */
export function closeRing(positions: readonly Position[]): Ring {
  if (positions.length === 0) return [];
  const first = positions[0];
  const last = positions[positions.length - 1];
  const isClosed = first[0] === last[0] && first[1] === last[1];
  return isClosed ? positions : [...positions, first];
}

export function bboxOfRing(ring: Ring): BoundingBox {
  const longitudes = ring.map((position) => position[0]);
  const latitudes = ring.map((position) => position[1]);
  return [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes),
  ];
}

function bboxCenter(bbox: BoundingBox): LatLon {
  return { lat: (bbox[1] + bbox[3]) / 2, lon: (bbox[0] + bbox[2]) / 2 };
}

/** Signed area in square metres (positive when the ring runs counter-clockwise). */
function signedAreaSquareMeters(ring: Ring): number {
  const closed = closeRing(ring);
  if (closed.length < 4) return 0;
  const origin = bboxCenter(bboxOfRing(closed));
  const points = closed.map((position) => toLocalMeters(position, origin));
  let doubled = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    doubled += points[index].x * points[index + 1].y - points[index + 1].x * points[index].y;
  }
  return doubled / 2;
}

export function ringAreaHectares(ring: Ring): number {
  return Math.abs(signedAreaSquareMeters(ring)) / SQUARE_METERS_PER_HECTARE;
}

/** Area-weighted centroid. Falls back to the bounding-box centre for degenerate rings. */
export function centroidOfRing(ring: Ring): LatLon {
  const closed = closeRing(ring);
  const fallback = bboxCenter(bboxOfRing(closed));
  const area = signedAreaSquareMeters(closed);
  if (area === 0) return fallback;

  const points = closed.map((position) => toLocalMeters(position, fallback));
  let sumX = 0;
  let sumY = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const cross = points[index].x * points[index + 1].y - points[index + 1].x * points[index].y;
    sumX += (points[index].x + points[index + 1].x) * cross;
    sumY += (points[index].y + points[index + 1].y) * cross;
  }
  const [lon, lat] = fromLocalMeters({ x: sumX / (6 * area), y: sumY / (6 * area) }, fallback);
  return { lat, lon };
}

/** Ray-casting test. Points exactly on an edge may fall on either side. */
export function isPointInRing(position: Position, ring: Ring): boolean {
  const closed = closeRing(ring);
  let inside = false;
  for (let current = 0, previous = closed.length - 1; current < closed.length; previous = current, current += 1) {
    const [currentX, currentY] = closed[current];
    const [previousX, previousY] = closed[previous];
    const crosses =
      currentY > position[1] !== previousY > position[1] &&
      position[0] <
        ((previousX - currentX) * (position[1] - currentY)) / (previousY - currentY) + currentX;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** True when two segments of the ring cross each other (a "bow-tie" outline). */
export function isSelfIntersecting(ring: Ring): boolean {
  const closed = closeRing(ring);
  const segments = closed.length - 1;
  const orientation = (a: Position, b: Position, c: Position) =>
    Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));

  for (let first = 0; first < segments; first += 1) {
    for (let second = first + 1; second < segments; second += 1) {
      // Neighbouring segments share a vertex; that is not a crossing.
      const areNeighbours = second === first + 1 || (first === 0 && second === segments - 1);
      if (areNeighbours) continue;
      const a = closed[first];
      const b = closed[first + 1];
      const c = closed[second];
      const d = closed[second + 1];
      if (
        orientation(a, b, c) !== orientation(a, b, d) &&
        orientation(c, d, a) !== orientation(c, d, b)
      ) {
        return true;
      }
    }
  }
  return false;
}

/** A square of `sideMeters` centred on `center`, as a closed counter-clockwise ring. */
export function squareAround(center: LatLon, sideMeters: number): Ring {
  const half = sideMeters / 2;
  const corners: readonly LocalPoint[] = [
    { x: -half, y: -half },
    { x: half, y: -half },
    { x: half, y: half },
    { x: -half, y: half },
  ];
  return closeRing(corners.map((corner) => fromLocalMeters(corner, center)));
}

function toPolygon(ring: Ring): PolygonGeometry {
  return { type: "Polygon", coordinates: [closeRing(ring)] };
}

/** The area analysed when the person gives only a point: a square of a stated size. */
export function bufferArea(center: LatLon, sideMeters: number): AnalysisArea {
  const ring = squareAround(center, sideMeters);
  return {
    kind: "buffer",
    center,
    polygon: toPolygon(ring),
    bbox: bboxOfRing(ring),
    areaHectares: ringAreaHectares(ring),
    bufferSideMeters: sideMeters,
  };
}

/** The area analysed when the person draws the outline of the plot. */
export function polygonArea(positions: readonly Position[]): AnalysisArea {
  const ring = closeRing(positions);
  return {
    kind: "polygon",
    center: centroidOfRing(ring),
    polygon: toPolygon(ring),
    bbox: bboxOfRing(ring),
    areaHectares: ringAreaHectares(ring),
    bufferSideMeters: null,
  };
}

/**
 * Sample points on a regular grid over the bounding box of the area, row by
 * row from the north-west corner. Used to read rasters at a known spacing.
 */
export function gridOverBbox(
  bbox: BoundingBox,
  columns: number,
  rows: number,
): { readonly points: readonly Position[]; readonly spacingMeters: { readonly x: number; readonly y: number } } {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const scale = metersPerDegree((minLat + maxLat) / 2);
  const stepLon = columns > 1 ? (maxLon - minLon) / (columns - 1) : 0;
  const stepLat = rows > 1 ? (maxLat - minLat) / (rows - 1) : 0;
  const points: Position[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      points.push([minLon + column * stepLon, maxLat - row * stepLat]);
    }
  }
  return { points, spacingMeters: { x: stepLon * scale.lon, y: stepLat * scale.lat } };
}
