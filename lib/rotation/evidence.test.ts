import { describe, expect, it } from "vitest";
import { evidenceFor, isKnownHost, PREVIOUS_CROPS } from "./evidence";

describe("evidenceFor", () => {
  it("returns the figures printed in the paper's Cuadro 2 (stage R8, 2009)", () => {
    const at2009 = (crop: Parameters<typeof evidenceFor>[0]) =>
      evidenceFor(crop).find((observation) => observation.setting === "brunca-2009")?.incidencePercent;
    expect(at2009("chili")).toBe(3.66);
    expect(at2009("squash")).toBe(15.43);
    expect(at2009("rice")).toBe(28.73);
    expect(at2009("maize")).toBe(63.57);
    expect(at2009("beans")).toBe(62.19);
  });

  it("returns the single-farm observation of 2010", () => {
    const at2010 = (crop: Parameters<typeof evidenceFor>[0]) =>
      evidenceFor(crop).find((observation) => observation.setting === "pejibaye-2010")?.incidencePercent;
    expect(at2010("ginger")).toBe(4);
    expect(at2010("tannia")).toBe(5);
    expect(at2010("maize")).toBe(25);
  });

  it("has no evidence for crops the study did not look at", () => {
    expect(evidenceFor("cover-crop")).toEqual([]);
    expect(evidenceFor("pasture")).toEqual([]);
    expect(evidenceFor("other")).toEqual([]);
    expect(evidenceFor("unknown")).toEqual([]);
  });

  it("keeps every percentage between 0 and 100", () => {
    PREVIOUS_CROPS.flatMap((crop) => evidenceFor(crop)).forEach((observation) => {
      expect(observation.incidencePercent).toBeGreaterThanOrEqual(0);
      expect(observation.incidencePercent).toBeLessThanOrEqual(100);
    });
  });
});

describe("isKnownHost", () => {
  it("follows what the paper states about each crop", () => {
    expect(isKnownHost("maize")).toBe(true);
    expect(isKnownHost("rice")).toBe(true);
    expect(isKnownHost("beans")).toBe(true);
    expect(isKnownHost("squash")).toBe(false);
    expect(isKnownHost("ginger")).toBe(false);
  });

  it("does not guess for crops the paper does not mention", () => {
    expect(isKnownHost("cover-crop")).toBeNull();
    expect(isKnownHost("pasture")).toBeNull();
    expect(isKnownHost("unknown")).toBeNull();
  });
});
