import { describe, expect, it } from "vitest";
import { buildRotationComparison } from "./compare";
import type { CoverLevel } from "./exposure";
import { parseRotationRequest } from "./schema";

const RAIN = [10, 10, 10, 10, 300, 300, 300, 300, 300, 300, 100, 100];

function months(pattern: string): CoverLevel[] {
  const levels: Record<string, CoverLevel> = { B: "bare", L: "low", M: "medium", H: "high" };
  return pattern.split("").map((letter) => levels[letter]);
}

const VALID = {
  baselineId: "current",
  monthlyRainMm: RAIN,
  plans: [
    { id: "current", previousCrop: "maize", months: months("MMMMBBLMHHLM") },
    { id: "tannia", previousCrop: "tannia", months: months("MMMMLMHHHHLM") },
    { id: "cover", previousCrop: "cover-crop", months: months("MMMMHHHHHHLM") },
  ],
};

describe("parseRotationRequest", () => {
  it("accepts three declared rotations", () => {
    expect(parseRotationRequest(VALID).ok).toBe(true);
  });

  it("accepts months without rainfall data as null", () => {
    expect(parseRotationRequest({ ...VALID, monthlyRainMm: [null, ...RAIN.slice(1)] }).ok).toBe(true);
  });

  it("rejects a year that does not have twelve months", () => {
    const short = { ...VALID, plans: [{ ...VALID.plans[0], months: months("BBB") }, VALID.plans[1]] };
    expect(parseRotationRequest(short).ok).toBe(false);
    expect(parseRotationRequest({ ...VALID, monthlyRainMm: [1, 2, 3] }).ok).toBe(false);
  });

  it("rejects unknown crops, unknown cover levels and negative rain", () => {
    const badCrop = { ...VALID, plans: [{ ...VALID.plans[0], previousCrop: "banana" }, VALID.plans[1]] };
    const badLevel = { ...VALID, plans: [{ ...VALID.plans[0], months: new Array(12).fill("jungle") }, VALID.plans[1]] };
    expect(parseRotationRequest(badCrop).ok).toBe(false);
    expect(parseRotationRequest(badLevel).ok).toBe(false);
    expect(parseRotationRequest({ ...VALID, monthlyRainMm: [-5, ...RAIN.slice(1)] }).ok).toBe(false);
  });

  it("rejects a single rotation, repeated ids and a baseline that is not listed", () => {
    expect(parseRotationRequest({ ...VALID, plans: [VALID.plans[0]] }).ok).toBe(false);
    expect(parseRotationRequest({ ...VALID, plans: [VALID.plans[0], VALID.plans[0]] }).ok).toBe(false);
    expect(parseRotationRequest({ ...VALID, baselineId: "other" }).ok).toBe(false);
  });

  it("rejects non-objects and extra fields", () => {
    expect(parseRotationRequest(null).ok).toBe(false);
    expect(parseRotationRequest({ ...VALID, note: "x" }).ok).toBe(false);
  });
});

describe("buildRotationComparison", () => {
  const parsed = parseRotationRequest(VALID);
  if (!parsed.ok) throw new Error("the valid sample must parse");
  const result = buildRotationComparison(parsed.request);
  const reading = (id: string) => result.readings.find((entry) => entry.planId === id);

  it("keeps evidence and soil exposure as separate readings", () => {
    expect(reading("current")?.evidence.map((item) => item.incidencePercent)).toEqual([63.57, 25]);
    expect(reading("current")?.knownHost).toBe(true);
    expect(reading("current")?.exposure?.relativeToBaseline).toBe(1);
  });

  it("shows a covered rotation as less exposed and says when there is no evidence", () => {
    expect(reading("cover")?.exposure?.relativeToBaseline).toBeLessThan(1);
    expect(reading("cover")?.evidence).toEqual([]);
    expect(reading("cover")?.knownHost).toBeNull();
  });

  it("returns the evidence even when rainfall is incomplete, and says what is missing", () => {
    const incomplete = buildRotationComparison({
      ...parsed.request,
      monthlyRainMm: [null, ...RAIN.slice(1)],
    });
    expect(incomplete.exposureGap).toBe("rain-incomplete");
    expect(incomplete.erosivityShares).toBeNull();
    expect(incomplete.readings.every((entry) => entry.exposure === null)).toBe(true);
    expect(incomplete.readings[0].evidence).toHaveLength(2);
  });

  it("names the study the evidence comes from", () => {
    expect(result.study.year).toBe(2012);
    expect(result.exposureGap).toBeNull();
  });
});
