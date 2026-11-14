import { describe, expect, it } from "vitest";
import {
  classifySlopePercent,
  hornSlopeRatio,
  ratioToDegrees,
  ratioToPercent,
  roundTo,
  SLOPE_CLASS_BOUNDS,
  slopeClassShares,
  slopeRatioGrid,
  summarise,
} from "./slope";

/** Builds a grid from a surface z(x, y), with x east and y north, in metres. */
function surfaceGrid(
  columns: number,
  rows: number,
  spacing: { x: number; y: number },
  height: (eastMeters: number, northMeters: number) => number,
): number[] {
  const values: number[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      // Row 0 is the northernmost row, as in `gridOverBbox`.
      values.push(height(column * spacing.x, (rows - 1 - row) * spacing.y));
    }
  }
  return values;
}

const SQUARE_30M = { x: 30, y: 30 };

describe("hornSlopeRatio", () => {
  it("is zero on a flat plane", () => {
    expect(hornSlopeRatio([40, 40, 40, 40, 40, 40, 40, 40, 40], SQUARE_30M)).toBe(0);
  });

  it("gives 10 % on a ramp that rises 3 m every 30 m eastwards", () => {
    const ramp = [0, 3, 6, 0, 3, 6, 0, 3, 6];
    expect(hornSlopeRatio(ramp, SQUARE_30M)).toBeCloseTo(0.1, 12);
  });

  it("gives the same slope whichever way the ramp faces", () => {
    const risingNorth = [6, 6, 6, 3, 3, 3, 0, 0, 0];
    const risingWest = [6, 3, 0, 6, 3, 0, 6, 3, 0];
    expect(hornSlopeRatio(risingNorth, SQUARE_30M)).toBeCloseTo(0.1, 12);
    expect(hornSlopeRatio(risingWest, SQUARE_30M)).toBeCloseTo(0.1, 12);
  });

  it("combines both directions on a tilted plane (0.06 east and 0.08 north make 0.10)", () => {
    const plane = surfaceGrid(3, 3, SQUARE_30M, (east, north) => 100 + 0.06 * east + 0.08 * north);
    expect(hornSlopeRatio(plane, SQUARE_30M)).toBeCloseTo(0.1, 12);
  });

  it("uses the real cell size in each direction", () => {
    const spacing = { x: 25, y: 40 };
    const plane = surfaceGrid(3, 3, spacing, (east, north) => 0.03 * east + 0.04 * north);
    expect(hornSlopeRatio(plane, spacing)).toBeCloseTo(0.05, 12);
  });

  it("ignores the centre cell, as Horn's method does", () => {
    expect(hornSlopeRatio([5, 5, 5, 5, 999, 5, 5, 5, 5], SQUARE_30M)).toBe(0);
  });

  it("returns null instead of guessing when a neighbour is missing", () => {
    expect(hornSlopeRatio([0, 3, 6, 0, 3, null, 0, 3, 6], SQUARE_30M)).toBeNull();
    expect(hornSlopeRatio([0, 3, 6, 0, 3, undefined, 0, 3, 6], SQUARE_30M)).toBeNull();
  });

  it("treats zero elevation as a real value, not as missing", () => {
    expect(hornSlopeRatio([0, 0, 0, 0, 0, 0, 0, 0, 0], SQUARE_30M)).toBe(0);
  });

  it("returns null for a window of the wrong size or a cell size of zero", () => {
    expect(hornSlopeRatio([1, 2, 3], SQUARE_30M)).toBeNull();
    expect(hornSlopeRatio([0, 3, 6, 0, 3, 6, 0, 3, 6], { x: 0, y: 30 })).toBeNull();
  });
});

describe("slopeRatioGrid", () => {
  it("computes interior cells and leaves the border of the grid empty", () => {
    const grid = surfaceGrid(4, 4, SQUARE_30M, (east) => 0.1 * east);
    const slopes = slopeRatioGrid(grid, 4, 4, SQUARE_30M);
    const interior = [5, 6, 9, 10];

    expect(slopes).toHaveLength(16);
    slopes.forEach((slope, index) => {
      if (interior.includes(index)) expect(slope).toBeCloseTo(0.1, 12);
      else expect(slope).toBeNull();
    });
  });

  it("leaves empty only the cells whose window touches a missing value", () => {
    const grid: (number | null)[] = surfaceGrid(5, 5, SQUARE_30M, () => 12);
    const withGap = grid.map((value, index) => (index === 0 ? null : value));
    const slopes = slopeRatioGrid(withGap, 5, 5, SQUARE_30M);

    // Cell (1,1) has the missing corner in its window; cell (2,2) does not.
    expect(slopes[6]).toBeNull();
    expect(slopes[12]).toBe(0);
  });

  it("returns only empty cells when every elevation is missing", () => {
    const slopes = slopeRatioGrid(new Array<number | null>(9).fill(null), 3, 3, SQUARE_30M);
    expect(slopes.every((slope) => slope === null)).toBe(true);
  });

  it("returns an empty list for an empty grid", () => {
    expect(slopeRatioGrid([], 0, 0, SQUARE_30M)).toEqual([]);
  });

  it("rejects a grid whose size does not match its values", () => {
    expect(() => slopeRatioGrid([1, 2, 3], 2, 2, SQUARE_30M)).toThrow(RangeError);
  });
});

describe("unit conversions", () => {
  it("converts rise over run to percent", () => {
    expect(ratioToPercent(0)).toBe(0);
    expect(ratioToPercent(0.1)).toBeCloseTo(10, 12);
    expect(ratioToPercent(1)).toBe(100);
  });

  it("converts rise over run to degrees", () => {
    expect(ratioToDegrees(0)).toBe(0);
    expect(ratioToDegrees(1)).toBeCloseTo(45, 12);
    // A 10 % slope is arctan(0.1) = 5.71°, not 10°.
    expect(ratioToDegrees(0.1)).toBeCloseTo(5.7106, 4);
  });
});

describe("slope classes", () => {
  it("covers every slope from zero upwards without gaps", () => {
    expect(SLOPE_CLASS_BOUNDS[0].fromPercent).toBe(0);
    SLOPE_CLASS_BOUNDS.slice(1).forEach((bounds, index) => {
      expect(bounds.fromPercent).toBe(SLOPE_CLASS_BOUNDS[index].toPercent);
    });
    expect(SLOPE_CLASS_BOUNDS[SLOPE_CLASS_BOUNDS.length - 1].toPercent).toBeNull();
  });

  it("puts each boundary in the upper class", () => {
    expect(classifySlopePercent(0)).toBe("flat");
    expect(classifySlopePercent(1.99)).toBe("flat");
    expect(classifySlopePercent(2)).toBe("gentle");
    expect(classifySlopePercent(5)).toBe("moderate");
    expect(classifySlopePercent(14.99)).toBe("moderate");
    expect(classifySlopePercent(15)).toBe("steep");
    expect(classifySlopePercent(250)).toBe("steep");
  });

  it("reports shares that add up to one", () => {
    const shares = slopeClassShares([0, 1, 3, 7, 20, 40, 0.5, 1.5]);
    expect(shares.map((entry) => entry.slopeClass)).toEqual(["flat", "gentle", "moderate", "steep"]);
    expect(shares.map((entry) => entry.share)).toEqual([0.5, 0.125, 0.125, 0.25]);
    expect(shares.reduce((total, entry) => total + entry.share, 0)).toBe(1);
  });

  it("keeps a class with no cells as a real zero", () => {
    const shares = slopeClassShares([0, 0, 0]);
    expect(shares.find((entry) => entry.slopeClass === "steep")?.share).toBe(0);
    expect(shares.find((entry) => entry.slopeClass === "flat")?.share).toBe(1);
  });

  it("returns no classes at all when there is no slope to classify", () => {
    expect(slopeClassShares([])).toEqual([]);
  });
});

describe("summarise", () => {
  it("returns mean, minimum and maximum", () => {
    expect(summarise([36, 40, 44])).toEqual({ mean: 40, min: 36, max: 44 });
  });

  it("keeps zeros as values", () => {
    expect(summarise([0, 0])).toEqual({ mean: 0, min: 0, max: 0 });
  });

  it("returns null for an empty list", () => {
    expect(summarise([])).toBeNull();
  });
});

describe("roundTo", () => {
  it("rounds to the requested decimals", () => {
    expect(roundTo(38.4567, 1)).toBe(38.5);
    expect(roundTo(5.7106, 2)).toBe(5.71);
    expect(roundTo(12, 1)).toBe(12);
  });
});
