import { describe, expect, it } from "vitest";
import { tintOpacity } from "./tint";

describe("tintOpacity", () => {
  it("gives no tint to a missing value", () => {
    expect(tintOpacity(null)).toBe(0);
    expect(tintOpacity(Number.NaN)).toBe(0);
  });

  it("keeps a trace for zero and grows with the share, within bounds", () => {
    expect(tintOpacity(0)).toBeGreaterThan(0);
    expect(tintOpacity(0.5)).toBeGreaterThan(tintOpacity(0.1));
    expect(tintOpacity(1)).toBeLessThanOrEqual(1);
    expect(tintOpacity(5)).toBe(tintOpacity(1));
  });
});
