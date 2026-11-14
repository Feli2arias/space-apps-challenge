import { describe, expect, it } from "vitest";
import {
  compareRotations,
  COVER_PERCENT,
  erosivityShares,
  soilLossRatio,
  SURFACE_COVER_COEFFICIENT,
  type CoverLevel,
  type RotationPlan,
} from "./exposure";

/** Dry from January to April, 300 mm a month from May to October, 100 mm in November and December. */
const RAIN = [10, 10, 10, 10, 300, 300, 300, 300, 300, 300, 100, 100];

function plan(id: string, months: string): RotationPlan {
  const levels: Record<string, CoverLevel> = { B: "bare", L: "low", M: "medium", H: "high" };
  return { id, months: months.split("").map((letter) => levels[letter]) };
}

describe("soilLossRatio", () => {
  it("is 1 for bare soil and falls as cover grows", () => {
    const b = SURFACE_COVER_COEFFICIENT.typical;
    expect(soilLossRatio(0, b)).toBe(1);
    expect(soilLossRatio(30, b)).toBeCloseTo(Math.exp(-1.05), 10);
    expect(soilLossRatio(90, b)).toBeLessThan(soilLossRatio(60, b));
  });
});

describe("erosivityShares", () => {
  it("adds up to 1 and gives most of the weight to the rainiest months", () => {
    const shares = erosivityShares(RAIN);
    expect(shares).not.toBeNull();
    expect(shares?.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10);
    expect(shares?.[5]).toBeGreaterThan((shares?.[10] ?? 0) * 8);
  });

  it("splits evenly when it rains the same every month", () => {
    expect(erosivityShares(new Array(12).fill(100))?.[0]).toBeCloseTo(1 / 12, 10);
  });

  it("keeps a month with zero rain as a real zero", () => {
    const shares = erosivityShares([0, ...new Array(11).fill(50)]);
    expect(shares?.[0]).toBe(0);
  });

  it("returns null when a month is missing, negative or the list is not a year", () => {
    expect(erosivityShares([null, ...new Array(11).fill(50)])).toBeNull();
    expect(erosivityShares([-1, ...new Array(11).fill(50)])).toBeNull();
    expect(erosivityShares([10, 20])).toBeNull();
  });

  it("returns null when it never rains", () => {
    expect(erosivityShares(new Array(12).fill(0))).toBeNull();
  });
});

describe("compareRotations", () => {
  const current = plan("current", "MMMMBBLMHHLM");
  const covered = plan("covered", "MMMMHHLMHHLM");
  const worse = plan("worse", "MMMMBBBBHHLM");

  it("gives the baseline a ratio of exactly 1", () => {
    const comparison = compareRotations([current, covered], "current", RAIN);
    const baseline = comparison?.exposures.find((exposure) => exposure.planId === "current");
    expect(baseline?.relativeToBaseline).toBe(1);
    expect(baseline?.relativeRange).toEqual({ low: 1, high: 1 });
  });

  it("rates a plan that covers the rainy bare months as less exposed", () => {
    const comparison = compareRotations([current, covered, worse], "current", RAIN);
    const byId = new Map(comparison?.exposures.map((exposure) => [exposure.planId, exposure]));
    expect(byId.get("covered")?.relativeToBaseline).toBeLessThan(1);
    expect(byId.get("worse")?.relativeToBaseline).toBeGreaterThan(1);
  });

  it("lists bare months, and which of them are rainier than average", () => {
    const dryBare = plan("dry-bare", "BBMMBMMMMMMM");
    const exposure = compareRotations([dryBare], "dry-bare", RAIN)?.exposures[0];
    expect(exposure?.bareMonths).toEqual([1, 2, 5]);
    expect(exposure?.bareRainyMonths).toEqual([5]);
    expect(exposure?.rainShareOnBare).toBeCloseTo(320 / 2040, 10);
  });

  it("is 1 for a year of bare soil and near 0 for a year of high cover", () => {
    const bare = plan("bare", "BBBBBBBBBBBB");
    const high = plan("high", "HHHHHHHHHHHH");
    const comparison = compareRotations([bare, high], "bare", RAIN);
    expect(comparison?.exposures[0].index).toBeCloseTo(1, 10);
    expect(comparison?.exposures[1].index).toBeCloseTo(
      soilLossRatio(COVER_PERCENT.high, SURFACE_COVER_COEFFICIENT.typical),
      10,
    );
  });

  it("gives a range that contains the typical ratio", () => {
    const exposure = compareRotations([current, covered], "current", RAIN)?.exposures[1];
    expect(exposure?.relativeRange).not.toBeNull();
    expect(exposure?.relativeRange?.low).toBeLessThanOrEqual(exposure?.relativeToBaseline ?? 0);
    expect(exposure?.relativeRange?.high).toBeGreaterThanOrEqual(exposure?.relativeToBaseline ?? 2);
  });

  it("does not depend on where the plot is: only rain and cover matter", () => {
    const first = compareRotations([current, covered], "current", RAIN);
    const doubled = compareRotations([current, covered], "current", RAIN.map((value) => value * 2));
    expect(doubled?.exposures[1].relativeToBaseline).toBeCloseTo(
      first?.exposures[1].relativeToBaseline ?? 0,
      10,
    );
  });

  it("returns null without complete rainfall, with a malformed plan or an unknown baseline", () => {
    expect(compareRotations([current], "current", [null, ...RAIN.slice(1)])).toBeNull();
    expect(compareRotations([{ id: "short", months: ["bare"] }], "short", RAIN)).toBeNull();
    expect(compareRotations([current], "missing", RAIN)).toBeNull();
    expect(compareRotations([], "current", RAIN)).toBeNull();
  });
});
