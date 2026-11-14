import { describe, expect, it } from "vitest";
import { lastFullYears } from "./period";

describe("lastFullYears", () => {
  it("ends on the last day of the previous year", () => {
    expect(lastFullYears(5, new Date("2026-11-14T12:00:00Z"))).toEqual({
      start: "2021-01-01",
      end: "2025-12-31",
    });
  });

  it("covers a single year when asked for one", () => {
    expect(lastFullYears(1, new Date("2026-01-01T00:00:00Z"))).toEqual({
      start: "2025-01-01",
      end: "2025-12-31",
    });
  });
});
