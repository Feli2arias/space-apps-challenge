import { describe, expect, it } from "vitest";
import {
  isInRange,
  parseCoordinate,
  parseCoordinatePair,
  roundCoordinate,
  roundPoint,
} from "./coordinates";

describe("parseCoordinate", () => {
  it("reads decimal degrees with a point", () => {
    expect(parseCoordinate("10.95", "latitude")).toEqual({ ok: true, value: 10.95 });
    expect(parseCoordinate("-84.72", "longitude")).toEqual({ ok: true, value: -84.72 });
  });

  it("reads a decimal comma, as it is written in Spanish", () => {
    expect(parseCoordinate("10,95", "latitude")).toEqual({ ok: true, value: 10.95 });
    expect(parseCoordinate("-84,72", "longitude")).toEqual({ ok: true, value: -84.72 });
  });

  it("ignores spaces, the degree sign and an explicit plus", () => {
    expect(parseCoordinate("  10.95° ", "latitude")).toEqual({ ok: true, value: 10.95 });
    expect(parseCoordinate("+10.95", "latitude")).toEqual({ ok: true, value: 10.95 });
  });

  it("reads a typographic minus copied from formatted text", () => {
    expect(parseCoordinate("−84.72", "longitude")).toEqual({ ok: true, value: -84.72 });
  });

  it("turns a hemisphere letter into the sign", () => {
    expect(parseCoordinate("10.95 N", "latitude")).toEqual({ ok: true, value: 10.95 });
    expect(parseCoordinate("10.95 S", "latitude")).toEqual({ ok: true, value: -10.95 });
    expect(parseCoordinate("84.72 W", "longitude")).toEqual({ ok: true, value: -84.72 });
    expect(parseCoordinate("84,72° O", "longitude")).toEqual({ ok: true, value: -84.72 });
    expect(parseCoordinate("E 84.72", "longitude")).toEqual({ ok: true, value: 84.72 });
  });

  it("keeps zero as a real coordinate", () => {
    expect(parseCoordinate("0", "latitude")).toEqual({ ok: true, value: 0 });
    expect(parseCoordinate("-0.0", "longitude")).toEqual({ ok: true, value: -0 });
  });

  it("reports an empty field", () => {
    expect(parseCoordinate("", "latitude")).toEqual({ ok: false, problem: "empty" });
    expect(parseCoordinate("   ", "longitude")).toEqual({ ok: false, problem: "empty" });
  });

  it("reports text that is not a number", () => {
    const notANumber = { ok: false, problem: "not-a-number" };
    expect(parseCoordinate("abc", "latitude")).toEqual(notANumber);
    expect(parseCoordinate("10.9.5", "latitude")).toEqual(notANumber);
    expect(parseCoordinate("1e2", "latitude")).toEqual(notANumber);
    expect(parseCoordinate("10°57'00\"", "latitude")).toEqual(notANumber);
    expect(parseCoordinate("-", "latitude")).toEqual(notANumber);
  });

  it("rejects a hemisphere letter of the other axis or one that contradicts the sign", () => {
    const notANumber = { ok: false, problem: "not-a-number" };
    expect(parseCoordinate("84.72 W", "latitude")).toEqual(notANumber);
    expect(parseCoordinate("10.95 N", "longitude")).toEqual(notANumber);
    expect(parseCoordinate("-84.72 W", "longitude")).toEqual(notANumber);
  });

  it("checks the range of each axis, limits included", () => {
    expect(parseCoordinate("90", "latitude")).toEqual({ ok: true, value: 90 });
    expect(parseCoordinate("-90", "latitude")).toEqual({ ok: true, value: -90 });
    expect(parseCoordinate("90.00001", "latitude")).toEqual({ ok: false, problem: "out-of-range" });
    expect(parseCoordinate("180", "longitude")).toEqual({ ok: true, value: 180 });
    expect(parseCoordinate("-180.5", "longitude")).toEqual({ ok: false, problem: "out-of-range" });
    // A longitude typed in the latitude field is the commonest slip.
    expect(parseCoordinate("-84.72", "latitude")).toEqual({ ok: true, value: -84.72 });
    expect(parseCoordinate("-95", "latitude")).toEqual({ ok: false, problem: "out-of-range" });
  });
});

describe("parseCoordinatePair", () => {
  const LOS_CHILES = { lat: 10.95, lon: -84.72 };

  it("reads a pair separated by a comma, a space or a semicolon", () => {
    expect(parseCoordinatePair("10.95, -84.72")).toEqual(LOS_CHILES);
    expect(parseCoordinatePair("10.95,-84.72")).toEqual(LOS_CHILES);
    expect(parseCoordinatePair("10.95 -84.72")).toEqual(LOS_CHILES);
    expect(parseCoordinatePair("10.95; -84.72")).toEqual(LOS_CHILES);
    expect(parseCoordinatePair("10.95\t-84.72")).toEqual(LOS_CHILES);
  });

  it("reads a pair written with decimal commas", () => {
    expect(parseCoordinatePair("10,95, -84,72")).toEqual(LOS_CHILES);
    expect(parseCoordinatePair("10,95 -84,72")).toEqual(LOS_CHILES);
    expect(parseCoordinatePair("10,95; -84,72")).toEqual(LOS_CHILES);
    expect(parseCoordinatePair("10,95,-84,72")).toEqual(LOS_CHILES);
  });

  it("reads a pair wrapped in brackets or surrounded by spaces", () => {
    expect(parseCoordinatePair("(10.95, -84.72)")).toEqual(LOS_CHILES);
    expect(parseCoordinatePair("  [10.95, -84.72]  ")).toEqual(LOS_CHILES);
  });

  it("uses hemisphere letters, in either order", () => {
    expect(parseCoordinatePair("10.95°N 84.72°W")).toEqual(LOS_CHILES);
    expect(parseCoordinatePair("10.95° N, 84.72° O")).toEqual(LOS_CHILES);
    expect(parseCoordinatePair("84.72 W, 10.95 N")).toEqual(LOS_CHILES);
    expect(parseCoordinatePair("N 10.95, W 84.72")).toEqual(LOS_CHILES);
    expect(parseCoordinatePair("10.95,84.72W")).toEqual(LOS_CHILES);
  });

  it("assumes latitude first when there are no letters", () => {
    expect(parseCoordinatePair("-84.72, 10.95")).toEqual({ lat: -84.72, lon: 10.95 });
  });

  it("does not check ranges, so the form can point at the wrong field", () => {
    expect(parseCoordinatePair("95, -84.72")).toEqual({ lat: 95, lon: -84.72 });
  });

  it("does not mistake one number with a decimal comma for a pair", () => {
    expect(parseCoordinatePair("10,95")).toBeNull();
    expect(parseCoordinatePair("-84,72")).toBeNull();
  });

  it("returns null for anything that is not exactly two numbers", () => {
    expect(parseCoordinatePair("")).toBeNull();
    expect(parseCoordinatePair("10.95")).toBeNull();
    expect(parseCoordinatePair("10.95, -84.72, 30")).toBeNull();
    expect(parseCoordinatePair("Los Chiles, Alajuela")).toBeNull();
    expect(parseCoordinatePair("10.95, abc")).toBeNull();
    expect(parseCoordinatePair("10.95 N, 11.2 N")).toBeNull();
  });
});

describe("rounding", () => {
  it("keeps five decimals, about one metre", () => {
    expect(roundCoordinate(10.950004)).toBe(10.95);
    expect(roundCoordinate(-84.7200051)).toBe(-84.72001);
    expect(roundPoint({ lat: 10.123456789, lon: -84.987654321 })).toEqual({
      lat: 10.12346,
      lon: -84.98765,
    });
  });

  it("knows the range of each axis", () => {
    expect(isInRange(90, "latitude")).toBe(true);
    expect(isInRange(90.1, "latitude")).toBe(false);
    expect(isInRange(-180, "longitude")).toBe(true);
    expect(isInRange(181, "longitude")).toBe(false);
  });
});
