import { describe, expect, it } from "vitest";
import { bufferArea, isPointInRing, polygonArea, toLocalMeters } from "../geometry";
import type { AnalysisArea, Metric, Position } from "../types";
import losChilesResponse from "./__fixtures__/terrain-los-chiles-200m.json";
import { parseElevationResponse } from "./terrain";
import {
  MAX_GRID_POINTS,
  MIN_CELLS_FOR_SLOPE,
  NATIVE_SPACING_METERS,
  planElevationGrid,
  summariseTerrain,
  TERRAIN_METRIC,
  TERRAIN_NOTE,
} from "./terrain.compute";

/** The test area of the project: Los Chiles, Costa Rica. */
const LOS_CHILES = { lat: 10.95, lon: -84.72 };

function valueOf(metrics: readonly Metric[], id: string): number | null {
  const found = metrics.find((metric) => metric.id === id);
  if (!found) throw new Error(`Metric ${id} is missing.`);
  return found.value;
}

/** Elevations for every point of a plan, from a surface z(east, north) in metres. */
function surface(
  points: readonly Position[],
  height: (eastMeters: number, northMeters: number) => number,
): number[] {
  return points.map((point) => {
    const local = toLocalMeters(point, LOS_CHILES);
    return height(local.x, local.y);
  });
}

describe("planElevationGrid", () => {
  it("samples the default 200 m square in one request, with a ring of neighbours", () => {
    const area = bufferArea(LOS_CHILES, 200);
    const plan = planElevationGrid(area.bbox);
    const inside = plan.points.filter((point) => isPointInRing(point, area.polygon.coordinates[0]));

    expect(plan.columns).toBe(8);
    expect(plan.rows).toBe(8);
    expect(plan.points).toHaveLength(64);
    expect(inside).toHaveLength(36);
    expect(plan.spacing.x).toBeCloseTo(200 / 6, 6);
    expect(plan.spacing.y).toBeCloseTo(200 / 6, 6);
    expect(plan.coarsened).toBe(false);
  });

  it("puts every sample of the outer ring outside the area", () => {
    const area = bufferArea(LOS_CHILES, 200);
    const plan = planElevationGrid(area.bbox);
    const ring = area.polygon.coordinates[0];

    plan.points.forEach((point, index) => {
      const row = Math.floor(index / plan.columns);
      const column = index % plan.columns;
      const onRing = row === 0 || column === 0 || row === plan.rows - 1 || column === plan.columns - 1;
      expect(isPointInRing(point, ring)).toBe(!onRing);
    });
  });

  it("never samples closer together than the 30 m of the data", () => {
    for (const side of [20, 45, 100, 200, 500]) {
      const plan = planElevationGrid(bufferArea(LOS_CHILES, side).bbox);
      expect(plan.spacing.x).toBeGreaterThanOrEqual(NATIVE_SPACING_METERS - 1e-6);
      expect(plan.spacing.y).toBeGreaterThanOrEqual(NATIVE_SPACING_METERS - 1e-6);
    }
  });

  it("gives an area smaller than one cell a single sample and neighbours 30 m away", () => {
    const plan = planElevationGrid(bufferArea(LOS_CHILES, 20).bbox);
    expect(plan.columns).toBe(3);
    expect(plan.rows).toBe(3);
    expect(plan.spacing.x).toBeCloseTo(NATIVE_SPACING_METERS, 6);
    // The middle sample is the centre of the area.
    expect(plan.points[4][0]).toBeCloseTo(LOS_CHILES.lon, 9);
    expect(plan.points[4][1]).toBeCloseTo(LOS_CHILES.lat, 9);
  });

  it("uses a coarser grid, not more requests, for the largest plot allowed (500 ha)", () => {
    const plan = planElevationGrid(bufferArea(LOS_CHILES, 2236).bbox);
    expect(plan.points.length).toBeLessThanOrEqual(MAX_GRID_POINTS);
    expect(plan.points.length).toBeGreaterThan(MAX_GRID_POINTS / 2);
    expect(plan.spacing.x).toBeGreaterThan(NATIVE_SPACING_METERS);
    expect(plan.coarsened).toBe(true);
  });

  it("stays within the point limit for a long, thin box", () => {
    const thin = polygonArea([
      [-84.75, 10.95],
      [-84.69, 10.95],
      [-84.69, 10.9505],
      [-84.75, 10.9505],
    ]);
    const plan = planElevationGrid(thin.bbox);
    expect(plan.points.length).toBeLessThanOrEqual(MAX_GRID_POINTS);
    expect(plan.rows).toBe(3);
  });
});

describe("summariseTerrain with the real answer for Los Chiles", () => {
  const area = bufferArea(LOS_CHILES, 200);
  const plan = planElevationGrid(area.bbox);
  const elevations = parseElevationResponse(losChilesResponse, plan.points.length);

  it("was captured for exactly the points the plan asks for", () => {
    losChilesResponse.results.forEach((result, index) => {
      expect(result.location.lng).toBeCloseTo(plan.points[index][0], 5);
      expect(result.location.lat).toBeCloseTo(plan.points[index][1], 5);
    });
  });

  it("describes only the samples inside the square", () => {
    const [minLon, minLat, maxLon, maxLat] = area.bbox;
    const insideHeights = losChilesResponse.results
      .filter(({ location }) => location.lng > minLon && location.lng < maxLon && location.lat > minLat && location.lat < maxLat)
      .map((result) => result.elevation as number);
    const mean = insideHeights.reduce((total, height) => total + height, 0) / insideHeights.length;

    const result = summariseTerrain(plan, elevations, area);

    expect(insideHeights).toHaveLength(36);
    expect(result.status).toBe("ok");
    expect(result.scope).toBe("parcel");
    expect(result.period).toBeNull();
    expect(result.data.samples).toBe(36);
    expect(result.data.validSamples).toBe(36);
    expect(result.data.gridSpacingMeters).toBe(33.3);
    expect(valueOf(result.metrics, TERRAIN_METRIC.elevationMean)).toBeCloseTo(mean, 1);
    expect(valueOf(result.metrics, TERRAIN_METRIC.elevationMin)).toBe(Math.min(...insideHeights));
    expect(valueOf(result.metrics, TERRAIN_METRIC.elevationMax)).toBe(Math.max(...insideHeights));
    expect(valueOf(result.metrics, TERRAIN_METRIC.relief)).toBe(
      Math.max(...insideHeights) - Math.min(...insideHeights),
    );
    expect(result.quality).toEqual({ expected: 36, valid: 36, coverage: 1, notes: [] });
  });

  it("reports slope in percent and degrees, with classes that add up to one", () => {
    const result = summariseTerrain(plan, elevations, area);
    const meanPercent = valueOf(result.metrics, TERRAIN_METRIC.slopeMeanPercent) as number;
    const maxPercent = valueOf(result.metrics, TERRAIN_METRIC.slopeMaxPercent) as number;
    const meanDegrees = valueOf(result.metrics, TERRAIN_METRIC.slopeMeanDegrees) as number;

    expect(meanPercent).toBeGreaterThan(0);
    expect(maxPercent).toBeGreaterThanOrEqual(meanPercent);
    // For gentle slopes the angle in degrees is a little over half the percent value.
    expect(meanDegrees).toBeGreaterThan(0);
    expect(meanDegrees).toBeLessThan(meanPercent);
    expect(result.data.slopeClasses.reduce((total, entry) => total + entry.share, 0)).toBeCloseTo(1, 12);
  });
});

describe("summariseTerrain on surfaces that can be checked by hand", () => {
  const area = bufferArea(LOS_CHILES, 200);
  const plan = planElevationGrid(area.bbox);

  it("reports no slope and zero relief on flat land, as real zeros", () => {
    const result = summariseTerrain(plan, surface(plan.points, () => 40), area);

    expect(valueOf(result.metrics, TERRAIN_METRIC.slopeMeanPercent)).toBe(0);
    expect(valueOf(result.metrics, TERRAIN_METRIC.slopeMaxPercent)).toBe(0);
    expect(valueOf(result.metrics, TERRAIN_METRIC.slopeMeanDegrees)).toBe(0);
    expect(valueOf(result.metrics, TERRAIN_METRIC.relief)).toBe(0);
    expect(valueOf(result.metrics, TERRAIN_METRIC.elevationMean)).toBe(40);
    expect(result.data.slopeClasses.find((entry) => entry.slopeClass === "flat")?.share).toBe(1);
    expect(result.quality.notes).toEqual([]);
  });

  it("reports 10 % and 5.7° on a uniform 10 % ramp", () => {
    const result = summariseTerrain(plan, surface(plan.points, (east) => 100 + 0.1 * east), area);

    expect(valueOf(result.metrics, TERRAIN_METRIC.slopeMeanPercent)).toBe(10);
    expect(valueOf(result.metrics, TERRAIN_METRIC.slopeMaxPercent)).toBe(10);
    expect(valueOf(result.metrics, TERRAIN_METRIC.slopeMeanDegrees)).toBe(5.7);
    expect(result.data.slopeClasses.find((entry) => entry.slopeClass === "moderate")?.share).toBe(1);
    // The six columns of samples span 5 steps of 33.3 m, rising 0.1 m per metre.
    expect(valueOf(result.metrics, TERRAIN_METRIC.relief)).toBeCloseTo(16.7, 1);
  });

  it("flags the sea, which this dataset writes as 0 m everywhere", () => {
    const result = summariseTerrain(plan, surface(plan.points, () => 0), area);
    expect(result.status).toBe("ok");
    expect(valueOf(result.metrics, TERRAIN_METRIC.elevationMean)).toBe(0);
    expect(result.quality.notes).toEqual([TERRAIN_NOTE.zeroElevation]);
  });

  it("answers no-data, with every metric missing, when no elevation came back", () => {
    const result = summariseTerrain(plan, plan.points.map(() => null), area);

    expect(result.status).toBe("no-data");
    expect(result.metrics.every((metric) => metric.value === null)).toBe(true);
    expect(result.data.validSamples).toBe(0);
    expect(result.data.slopeClasses).toEqual([]);
    expect(result.quality).toEqual({ expected: 36, valid: 0, coverage: 0, notes: [TERRAIN_NOTE.noElevation] });
  });

  it("uses the valid samples and says so when a few are missing", () => {
    const flat: (number | null)[] = surface(plan.points, () => 40);
    // Index 0 is a corner of the outer ring; index 9 is the first sample inside the area.
    const withGaps = flat.map((height, index) => (index === 0 || index === 9 ? null : height));
    const result = summariseTerrain(plan, withGaps, area);

    expect(result.status).toBe("ok");
    expect(result.data.validSamples).toBe(35);
    expect(result.quality.coverage).toBeCloseTo(35 / 36, 12);
    expect(result.quality.notes).toEqual([TERRAIN_NOTE.missingElevation, TERRAIN_NOTE.slopeGaps]);
    expect(valueOf(result.metrics, TERRAIN_METRIC.slopeMeanPercent)).toBe(0);
  });

  it("does not invent a slope for an area smaller than four cells", () => {
    const small = bufferArea(LOS_CHILES, 45);
    const smallPlan = planElevationGrid(small.bbox);
    const result = summariseTerrain(smallPlan, surface(smallPlan.points, (east) => 0.1 * east + 50), small);

    expect(result.data.samples).toBeLessThan(MIN_CELLS_FOR_SLOPE);
    expect(valueOf(result.metrics, TERRAIN_METRIC.elevationMean)).toBe(50);
    expect(valueOf(result.metrics, TERRAIN_METRIC.slopeMeanPercent)).toBeNull();
    expect(valueOf(result.metrics, TERRAIN_METRIC.slopeMaxPercent)).toBeNull();
    expect(valueOf(result.metrics, TERRAIN_METRIC.slopeMeanDegrees)).toBeNull();
    // A single sample has no relief: missing, not zero.
    expect(valueOf(result.metrics, TERRAIN_METRIC.relief)).toBeNull();
    expect(result.data.slopeClasses).toEqual([]);
    expect(result.quality.notes).toEqual([TERRAIN_NOTE.areaTooSmallForSlope]);
  });

  it("computes a slope for the smallest square offered in the form (100 m)", () => {
    const hundred = bufferArea(LOS_CHILES, 100);
    const hundredPlan = planElevationGrid(hundred.bbox);
    const result = summariseTerrain(hundredPlan, surface(hundredPlan.points, (east) => 0.05 * east), hundred);

    expect(result.data.samples).toBe(9);
    expect(valueOf(result.metrics, TERRAIN_METRIC.slopeMeanPercent)).toBe(5);
    expect(result.quality.notes).toEqual([]);
  });

  it("falls back to the nearest sample, as a pixel value, when the outline misses every sample", () => {
    // A strip 4 m wide that runs between two columns of samples.
    const sliver: AnalysisArea = {
      ...area,
      kind: "polygon",
      polygon: {
        type: "Polygon",
        coordinates: [
          [
            [-84.72002, 10.9492],
            [-84.71998, 10.9492],
            [-84.71998, 10.9508],
            [-84.72002, 10.9508],
            [-84.72002, 10.9492],
          ],
        ],
      },
    };
    const result = summariseTerrain(plan, surface(plan.points, () => 40), sliver);

    expect(result.scope).toBe("pixel");
    expect(result.data.samples).toBe(1);
    expect(valueOf(result.metrics, TERRAIN_METRIC.elevationMean)).toBe(40);
    expect(valueOf(result.metrics, TERRAIN_METRIC.slopeMeanPercent)).toBeNull();
    expect(result.quality.notes).toEqual([TERRAIN_NOTE.noCellInside, TERRAIN_NOTE.areaTooSmallForSlope]);
  });

  it("notes when a large plot forced a coarser grid", () => {
    const large = bufferArea(LOS_CHILES, 2236);
    const largePlan = planElevationGrid(large.bbox);
    const result = summariseTerrain(largePlan, surface(largePlan.points, (east) => 0.02 * east), large);

    expect(result.quality.notes).toEqual([TERRAIN_NOTE.gridCoarsened]);
    expect(valueOf(result.metrics, TERRAIN_METRIC.slopeMeanPercent)).toBe(2);
    expect(result.data.gridSpacingMeters).toBeGreaterThan(NATIVE_SPACING_METERS);
  });

  it("rejects a list of elevations that does not match the plan", () => {
    expect(() => summariseTerrain(plan, [1, 2, 3], area)).toThrow(RangeError);
  });

  it("does not change its inputs", () => {
    const heights = Object.freeze(surface(plan.points, (east) => east));
    expect(() => summariseTerrain(plan, heights, area)).not.toThrow();
  });
});
