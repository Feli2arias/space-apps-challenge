import { describe, expect, it } from "vitest";
import { ditherFadeBitmap, ditherFadeMask } from "./dither-mask";

function filled(row: string): number {
  return row.split("").filter((pixel) => pixel === "#").length;
}

describe("ditherFadeBitmap", () => {
  it("has one row per requested row, four pixels wide", () => {
    const bitmap = ditherFadeBitmap(8);
    expect(bitmap).toHaveLength(8);
    bitmap.forEach((row) => expect(row).toHaveLength(4));
  });

  it("thins out from mostly solid at the top to mostly empty at the bottom", () => {
    const bitmap = ditherFadeBitmap(8);
    const top = filled(bitmap[0]) + filled(bitmap[1]);
    const bottom = filled(bitmap[6]) + filled(bitmap[7]);
    expect(top).toBeGreaterThan(bottom);
    expect(filled(bitmap[0])).toBeGreaterThanOrEqual(3);
    expect(filled(bitmap[7])).toBeLessThanOrEqual(1);
  });

  it("never returns an empty strip", () => {
    expect(ditherFadeBitmap(0)).toHaveLength(1);
  });
});

describe("ditherFadeMask", () => {
  it("is a CSS url with an SVG that uses no colour of its own", () => {
    const mask = ditherFadeMask(8);
    expect(mask.startsWith('url("data:image/svg+xml,')).toBe(true);
    const svg = decodeURIComponent(mask.slice('url("data:image/svg+xml,'.length, -2));
    expect(svg).toContain('viewBox="0 0 4 8"');
    expect(svg).not.toMatch(/#[0-9a-f]{3,6}|fill=/i);
  });
});
