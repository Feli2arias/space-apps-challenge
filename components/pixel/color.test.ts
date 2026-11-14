import { describe, expect, it } from "vitest";
import { parseHex } from "./color";

describe("parseHex", () => {
  it("parses six-digit hex colours", () => {
    expect(parseHex("#ff634a")).toEqual([255, 99, 74]);
  });

  it("parses the three-digit form that minifiers produce", () => {
    expect(parseHex("#fff")).toEqual([255, 255, 255]);
    expect(parseHex("#1a2")).toEqual([17, 170, 34]);
  });

  it("ignores surrounding whitespace and letter case", () => {
    expect(parseHex("  #F4F4F6 ")).toEqual([244, 244, 246]);
  });

  it("returns null for values it cannot read", () => {
    expect(parseHex("")).toBeNull();
    expect(parseHex("red")).toBeNull();
    expect(parseHex("#12")).toBeNull();
    expect(parseHex("#ffffff2e")).toBeNull();
    expect(parseHex("rgb(0, 0, 0)")).toBeNull();
  });
});
