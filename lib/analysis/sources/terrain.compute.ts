import { gridOverBbox, isPointInRing, metersPerDegree, toLocalMeters } from "../geometry";
import type {
  AnalysisArea,
  BoundingBox,
  LatLon,
  Metric,
  Position,
  SourcePayload,
  TerrainData,
} from "../types";
import {
  type GridSpacing,
  ratioToDegrees,
  ratioToPercent,
  roundTo,
  slopeClassShares,
  slopeRatioGrid,
  summarise,
} from "./slope";

/**
 * The pure half of the terrain source: where to sample the elevation model and
 * how to turn the samples into numbers. Nothing here touches the network, so
 * it can be tested against captured responses.
 */

/**
 * Spacing of SRTMGL1 samples: 1 arc-second, "about 30 m" (SRTM Collection User
 * Guide, LP DAAC, 2015, section 2.1.3). The grid is never finer than this:
 * sampling closer together would only repeat interpolated values.
 */
export const NATIVE_SPACING_METERS = 30;

/** Open Topo Data public API: "Max 100 locations per request" (opentopodata.org). */
export const MAX_LOCATIONS_PER_REQUEST = 100;

/**
 * Requests one analysis may spend. The public API allows 1 call per second and
 * 1000 per day for everyone using this app, so a large plot gets a coarser
 * grid instead of more calls. Four calls keep the wait under about five seconds.
 */
export const MAX_REQUESTS_PER_ANALYSIS = 4;

export const MAX_GRID_POINTS = MAX_LOCATIONS_PER_REQUEST * MAX_REQUESTS_PER_ANALYSIS;

/**
 * Fewest cells inside the area for a slope to be reported. The real detail of
 * SRTM 1 arc-second data is "in the range of 50 to 80 m" (same user guide), so
 * an area under roughly 60 m × 60 m (four 30 m cells) has no slope of its own
 * that this model can tell apart from the land around it.
 */
export const MIN_CELLS_FOR_SLOPE = 4;

/** How fast the spacing grows while searching for a grid that fits the point limit. */
const SPACING_GROWTH_FACTOR = 1.02;

/** SRTM heights are whole metres; one decimal is enough for a mean of several. */
const ELEVATION_DECIMALS = 1;
const SLOPE_DECIMALS = 1;
const SPACING_DECIMALS = 1;

export const TERRAIN_METRIC = {
  elevationMean: "terrain.elevationMean",
  elevationMin: "terrain.elevationMin",
  elevationMax: "terrain.elevationMax",
  relief: "terrain.relief",
  slopeMeanPercent: "terrain.slopeMeanPercent",
  slopeMaxPercent: "terrain.slopeMaxPercent",
  slopeMeanDegrees: "terrain.slopeMeanDegrees",
} as const;

/** Limitations that apply to every result of this source. */
export const TERRAIN_LIMITATIONS = ["pixel-smoothing", "surface-model-2000", "vertical-error"] as const;

export const TERRAIN_NOTE = {
  /** The area holds too few 30 m cells for a slope; none is reported. */
  areaTooSmallForSlope: "area-too-small-for-slope",
  /** No cell centre fell inside the outline; the nearest cell to its centre is used. */
  noCellInside: "no-cell-inside",
  /** Some cells inside the area came back without elevation. */
  missingElevation: "missing-elevation",
  /** Some cells have no slope because a neighbour has no elevation. */
  slopeGaps: "slope-gaps",
  /** The plot is large, so samples are further apart than the 30 m of the data. */
  gridCoarsened: "grid-coarsened",
  /** Every elevation is exactly 0 m, which is how this dataset writes the sea. */
  zeroElevation: "zero-elevation",
  /** The service has no elevation for this place. */
  noElevation: "no-elevation",
} as const;

/** Percent and degrees are both derived from the same rise over run. */
export const TERRAIN_CONVERSIONS = ["slope-percent-and-degrees"] as const;

export interface ElevationGridPlan {
  readonly columns: number;
  readonly rows: number;
  /** Row by row from the north-west corner; includes a ring of cells around the area. */
  readonly points: readonly Position[];
  readonly spacing: GridSpacing;
  /** True when the point limit forced a spacing wider than the native 30 m. */
  readonly coarsened: boolean;
}

function isNumber(value: number | null): value is number {
  return value !== null;
}

/** Whole cells of `spacing` metres that fit in `length`; at least one. */
function cellsAcross(length: number, spacing: number): number {
  return Math.max(1, Math.floor(length / spacing));
}

/** Points of a grid over the area plus one ring of neighbours on every side. */
function pointCount(width: number, height: number, spacing: number): number {
  return (cellsAcross(width, spacing) + 2) * (cellsAcross(height, spacing) + 2);
}

/** The finest spacing, from 30 m upwards, whose grid stays within the point limit. */
function targetSpacing(width: number, height: number): number {
  let spacing = NATIVE_SPACING_METERS;
  while (pointCount(width, height, spacing) > MAX_GRID_POINTS) {
    spacing *= SPACING_GROWTH_FACTOR;
  }
  return spacing;
}

/**
 * Decides where to read the elevation model.
 *
 * The bounding box is split into cells of about 30 m and each cell is sampled
 * at its centre, so no sample sits exactly on the edge of the area. One more
 * ring of cells is added around the box: those cells are not part of the
 * statistics, but Horn's method needs them to compute the slope of the cells
 * on the edge.
 */
export function planElevationGrid(bbox: BoundingBox): ElevationGridPlan {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const center: LatLon = { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 };
  const scale = metersPerDegree(center.lat);
  const width = (maxLon - minLon) * scale.lon;
  const height = (maxLat - minLat) * scale.lat;

  const target = targetSpacing(width, height);
  const innerColumns = cellsAcross(width, target);
  const innerRows = cellsAcross(height, target);
  // A side shorter than one cell still gets neighbours a full cell away.
  const stepX = Math.max(width / innerColumns, target);
  const stepY = Math.max(height / innerRows, target);

  const halfWidthDegrees = (((innerColumns + 1) / 2) * stepX) / scale.lon;
  const halfHeightDegrees = (((innerRows + 1) / 2) * stepY) / scale.lat;
  const padded: BoundingBox = [
    center.lon - halfWidthDegrees,
    center.lat - halfHeightDegrees,
    center.lon + halfWidthDegrees,
    center.lat + halfHeightDegrees,
  ];

  const columns = innerColumns + 2;
  const rows = innerRows + 2;
  const grid = gridOverBbox(padded, columns, rows);
  return {
    columns,
    rows,
    points: grid.points,
    spacing: grid.spacingMeters,
    coarsened: target > NATIVE_SPACING_METERS,
  };
}

function nearestPointIndex(points: readonly Position[], target: LatLon): number {
  const distances = points.map((point) => {
    const local = toLocalMeters(point, target);
    return Math.hypot(local.x, local.y);
  });
  return distances.indexOf(Math.min(...distances));
}

function metric(
  id: string,
  value: number | null,
  unit: Metric["unit"],
  aggregation: Metric["aggregation"],
  decimals: number,
): Metric {
  return { id, value: value === null ? null : roundTo(value, decimals), unit, aggregation };
}

function buildMetrics(heights: readonly number[], slopeRatios: readonly number[]): readonly Metric[] {
  const elevation = summarise(heights);
  const slopePercent = summarise(slopeRatios.map(ratioToPercent));
  const slopeDegrees = summarise(slopeRatios.map(ratioToDegrees));
  // One sample has no relief to speak of; reporting 0 m would read as "level ground".
  const relief = elevation !== null && heights.length > 1 ? elevation.max - elevation.min : null;

  return [
    metric(TERRAIN_METRIC.elevationMean, elevation?.mean ?? null, "m", "mean", ELEVATION_DECIMALS),
    metric(TERRAIN_METRIC.elevationMin, elevation?.min ?? null, "m", "min", ELEVATION_DECIMALS),
    metric(TERRAIN_METRIC.elevationMax, elevation?.max ?? null, "m", "max", ELEVATION_DECIMALS),
    metric(TERRAIN_METRIC.relief, relief, "m", "value", ELEVATION_DECIMALS),
    metric(TERRAIN_METRIC.slopeMeanPercent, slopePercent?.mean ?? null, "percent", "mean", SLOPE_DECIMALS),
    metric(TERRAIN_METRIC.slopeMaxPercent, slopePercent?.max ?? null, "percent", "max", SLOPE_DECIMALS),
    metric(TERRAIN_METRIC.slopeMeanDegrees, slopeDegrees?.mean ?? null, "degrees", "mean", SLOPE_DECIMALS),
  ];
}

interface NoteFacts {
  readonly usesNearestCell: boolean;
  readonly cells: number;
  readonly heights: readonly number[];
  readonly cellSlopes: number;
  readonly coarsened: boolean;
}

function buildNotes(facts: NoteFacts): readonly string[] {
  if (facts.heights.length === 0) return [TERRAIN_NOTE.noElevation];
  const tooSmall = facts.cells < MIN_CELLS_FOR_SLOPE;
  const checks: readonly (readonly [boolean, string])[] = [
    [facts.usesNearestCell, TERRAIN_NOTE.noCellInside],
    [tooSmall, TERRAIN_NOTE.areaTooSmallForSlope],
    [facts.heights.length < facts.cells, TERRAIN_NOTE.missingElevation],
    [!tooSmall && facts.cellSlopes < facts.cells, TERRAIN_NOTE.slopeGaps],
    [facts.coarsened, TERRAIN_NOTE.gridCoarsened],
    [facts.heights.every((height) => height === 0), TERRAIN_NOTE.zeroElevation],
  ];
  return checks.filter(([applies]) => applies).map(([, code]) => code);
}

/**
 * Turns the elevations of the planned grid into the terrain result.
 *
 * Statistics use only the cells whose centre is inside the outline of the
 * area. Their slope does use the neighbours outside it, because a slope is a
 * difference between a cell and the cells around it.
 */
export function summariseTerrain(
  plan: ElevationGridPlan,
  elevations: readonly (number | null)[],
  area: Pick<AnalysisArea, "polygon" | "center">,
): SourcePayload<TerrainData> {
  if (elevations.length !== plan.points.length) {
    throw new RangeError(`Expected ${plan.points.length} elevations, got ${elevations.length}.`);
  }
  const ring = area.polygon.coordinates[0];
  const inside = plan.points.flatMap((point, index) => (isPointInRing(point, ring) ? [index] : []));
  // A very thin outline can slip between cell centres; describe the cell at its centre instead.
  const usesNearestCell = inside.length === 0;
  const cells = usesNearestCell ? [nearestPointIndex(plan.points, area.center)] : inside;

  const heights = cells.map((index) => elevations[index]).filter(isNumber);
  const allSlopes = slopeRatioGrid(elevations, plan.columns, plan.rows, plan.spacing);
  const cellSlopes = cells.map((index) => allSlopes[index]).filter(isNumber);
  const slopes = cellSlopes.length >= MIN_CELLS_FOR_SLOPE ? cellSlopes : [];

  return {
    status: heights.length > 0 ? "ok" : "no-data",
    scope: usesNearestCell ? "pixel" : "parcel",
    period: null,
    metrics: buildMetrics(heights, slopes),
    data: {
      samples: cells.length,
      validSamples: heights.length,
      gridSpacingMeters: roundTo((plan.spacing.x + plan.spacing.y) / 2, SPACING_DECIMALS),
      slopeClasses: slopeClassShares(slopes.map(ratioToPercent)),
    },
    quality: {
      expected: cells.length,
      valid: heights.length,
      coverage: heights.length / cells.length,
      notes: buildNotes({
        usesNearestCell,
        cells: cells.length,
        heights,
        cellSlopes: cellSlopes.length,
        coarsened: plan.coarsened,
      }),
    },
    limitations: TERRAIN_LIMITATIONS,
    conversions: TERRAIN_CONVERSIONS,
  };
}
