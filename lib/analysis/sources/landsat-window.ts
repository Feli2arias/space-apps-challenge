import { isPointInRing } from "../geometry";
import type { LatLon, PolygonGeometry, Position } from "../types";
import type { SceneGrid } from "./landsat-stac";
import { toUtm, utmZoneFromEpsg } from "./landsat-utm";

/**
 * Decides which pixels of a scene belong to the analysed area.
 *
 * The outline is projected into the scene's own grid and a pixel belongs to the
 * area when its centre falls inside the outline (the usual rule for turning a
 * polygon into pixels). Pixels are never resampled or interpolated.
 */

/**
 * With fewer pixel centres than this inside the outline, the area is about one
 * 30 m pixel or smaller: a statistic "of the plot" would be a single value, so
 * the pixel under the centre of the area is used and reported as such.
 */
export const MIN_PIXELS_FOR_PARCEL = 2;

/**
 * Largest window read per scene, in pixels per side (15 km at 30 m). The
 * biggest area the app accepts (500 ha) is about 75 pixels across when it is
 * compact; this bound only rejects very long, thin outlines. Measured: a
 * 512 × 512 window answers in about 2 s and weighs 1.5 MB (80 × 80: 1.1 s,
 * 52 kB). Nothing larger was tested.
 */
export const MAX_WINDOW_SIDE_PIXELS = 512;

/** A block of pixels of the scene's raster. */
export interface PixelWindow {
  /** First column and row, counted from the top-left corner of the raster. */
  readonly column: number;
  readonly row: number;
  readonly width: number;
  readonly height: number;
}

export interface SceneWindowPlan {
  /** "parcel": pixels whose centre is inside the outline. "pixel": the one under the centre. */
  readonly mode: "parcel" | "pixel";
  /** What to read. `null` when the area lies wholly outside the scene's raster. */
  readonly window: PixelWindow | null;
  /** One flag per pixel of `window`, row by row from the top-left: true when it belongs to the area. */
  readonly inside: readonly boolean[];
  /** Pixels of the area in this scene's grid, including any that fall outside the raster. */
  readonly totalPixels: number;
}

export type PlanFailure = "unsupported-projection" | "area-too-wide";

export type PlanResult =
  | { readonly ok: true; readonly plan: SceneWindowPlan }
  | { readonly ok: false; readonly reason: PlanFailure };

interface PlannedArea {
  readonly polygon: PolygonGeometry;
  readonly center: LatLon;
}

interface PlannedScene {
  readonly epsg: number;
  readonly grid: SceneGrid;
}

/** Inclusive ranges of columns and rows; they may reach outside the raster. */
interface PixelRange {
  readonly firstColumn: number;
  readonly lastColumn: number;
  readonly firstRow: number;
  readonly lastRow: number;
}

const columnOf = (x: number, grid: SceneGrid): number => Math.floor((x - grid.originX) / grid.pixelSize);
// Rows count downwards from the top edge, so a larger Y is a smaller row.
const rowOf = (y: number, grid: SceneGrid): number => Math.floor((grid.originY - y) / grid.pixelSize);

function rangeOfRing(ring: readonly Position[], grid: SceneGrid): PixelRange {
  const xs = ring.map((point) => point[0]);
  const ys = ring.map((point) => point[1]);
  return {
    firstColumn: columnOf(Math.min(...xs), grid),
    lastColumn: columnOf(Math.max(...xs), grid),
    firstRow: rowOf(Math.max(...ys), grid),
    lastRow: rowOf(Math.min(...ys), grid),
  };
}

function isCentreInside(column: number, row: number, ring: readonly Position[], grid: SceneGrid): boolean {
  const centre: Position = [
    grid.originX + (column + 0.5) * grid.pixelSize,
    grid.originY - (row + 0.5) * grid.pixelSize,
  ];
  return isPointInRing(centre, ring);
}

function countInside(range: PixelRange, ring: readonly Position[], grid: SceneGrid): number {
  let count = 0;
  for (let row = range.firstRow; row <= range.lastRow; row += 1) {
    for (let column = range.firstColumn; column <= range.lastColumn; column += 1) {
      if (isCentreInside(column, row, ring, grid)) count += 1;
    }
  }
  return count;
}

/** Cuts the range to the raster. `null` when nothing of it is on the raster. */
function clipToRaster(range: PixelRange, grid: SceneGrid): PixelWindow | null {
  const column = Math.max(range.firstColumn, 0);
  const row = Math.max(range.firstRow, 0);
  const width = Math.min(range.lastColumn, grid.columns - 1) - column + 1;
  const height = Math.min(range.lastRow, grid.rows - 1) - row + 1;
  return width > 0 && height > 0 ? { column, row, width, height } : null;
}

function insideFlags(window: PixelWindow, ring: readonly Position[], grid: SceneGrid): readonly boolean[] {
  return Array.from({ length: window.width * window.height }, (_, index) =>
    isCentreInside(
      window.column + (index % window.width),
      window.row + Math.floor(index / window.width),
      ring,
      grid,
    ),
  );
}

function singlePixelPlan(centre: Position, grid: SceneGrid): SceneWindowPlan {
  const column = columnOf(centre[0], grid);
  const row = rowOf(centre[1], grid);
  const range: PixelRange = { firstColumn: column, lastColumn: column, firstRow: row, lastRow: row };
  const window = clipToRaster(range, grid);
  return { mode: "pixel", window, inside: window ? [true] : [], totalPixels: 1 };
}

/** Plans the read of one scene for one area. Pure: it makes no request. */
export function planSceneWindow(area: PlannedArea, scene: PlannedScene): PlanResult {
  const zone = utmZoneFromEpsg(scene.epsg);
  if (!zone) return { ok: false, reason: "unsupported-projection" };

  // From here on positions are [x, y] in metres of the scene's UTM zone.
  const project = (position: Position): Position => {
    const point = toUtm(position, zone);
    return [point.x, point.y];
  };
  const ring = area.polygon.coordinates[0].map(project);
  const range = rangeOfRing(ring, scene.grid);
  const widest = Math.max(range.lastColumn - range.firstColumn, range.lastRow - range.firstRow) + 1;
  if (widest > MAX_WINDOW_SIDE_PIXELS) return { ok: false, reason: "area-too-wide" };

  const totalPixels = countInside(range, ring, scene.grid);
  if (totalPixels < MIN_PIXELS_FOR_PARCEL) {
    const centre = project([area.center.lon, area.center.lat]);
    return { ok: true, plan: singlePixelPlan(centre, scene.grid) };
  }

  const window = clipToRaster(range, scene.grid);
  const inside = window ? insideFlags(window, ring, scene.grid) : [];
  return { ok: true, plan: { mode: "parcel", window, inside, totalPixels } };
}
