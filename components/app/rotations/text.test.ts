import { describe, expect, it } from "vitest";
import { ROTATIONS_DICTIONARY } from "@/lib/i18n/app/rotations";
import { exposureDirection, formatIncidence, formatRatio, monthList, noteText } from "./text";

const { es, en } = ROTATIONS_DICTIONARY;

describe("text helpers", () => {
  it("writes incidences with the decimals the paper printed", () => {
    expect(formatIncidence(63.57, es)).toBe("63,57 %");
    expect(formatIncidence(25, en)).toBe("25 %");
  });

  it("writes ratios with two decimals and never invents one", () => {
    expect(formatRatio(0.7512, es)).toBe("0,75");
    expect(formatRatio(null, es)).toBeNull();
  });

  it("does not call a ratio that rounds to 1,00 higher or lower", () => {
    expect(exposureDirection(1.004)).toBe("same");
    expect(exposureDirection(0.75)).toBe("lower");
    expect(exposureDirection(1.2)).toBe("higher");
  });

  it("lists months by name", () => {
    expect(monthList([1, 5, 9], es)).toBe("enero, mayo y septiembre");
  });

  it("fills crop and months into notes", () => {
    expect(noteText({ code: "host-risk", crop: "maize" }, es)).toContain("maíz");
    expect(noteText({ code: "cover-rainy", months: [9] }, en)).toContain("September");
  });
});
