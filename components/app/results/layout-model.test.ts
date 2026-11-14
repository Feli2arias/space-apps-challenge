import { describe, expect, it } from "vitest";
import type { Metric } from "@/lib/analysis/types";
import { CARD_FIGURES, splitMetrics } from "./layout-model";

const metric = (id: string, value: number | null = 1): Metric => ({ id, value, unit: "mm", aggregation: "mean" });

describe("CARD_FIGURES", () => {
  it("highlights two to four figures per source", () => {
    Object.values(CARD_FIGURES).forEach((ids) => {
      expect(ids.length).toBeGreaterThanOrEqual(2);
      expect(ids.length).toBeLessThanOrEqual(4);
    });
  });
});

describe("splitMetrics", () => {
  it("puts the highlighted figures first, in the given order, and keeps the rest in source order", () => {
    const metrics = [metric("a"), metric("x"), metric("b"), metric("y")];
    const split = splitMetrics(metrics, ["b", "a", "missing"]);
    expect(split.primary.map((item) => item.id)).toEqual(["b", "a"]);
    expect(split.rest.map((item) => item.id)).toEqual(["x", "y"]);
  });

  it("keeps a missing value as a highlighted figure instead of hiding it", () => {
    expect(splitMetrics([metric("a", null)], ["a"]).primary[0].value).toBeNull();
  });

  it("highlights the first metrics when none of the expected ids came back, losing none", () => {
    const split = splitMetrics([metric("n1"), metric("n2"), metric("n3"), metric("n4")], CARD_FIGURES.rain);
    expect(split.primary.map((item) => item.id)).toEqual(["n1", "n2", "n3"]);
    expect(split.rest.map((item) => item.id)).toEqual(["n4"]);
    expect(splitMetrics(null, ["a"])).toEqual({ primary: [], rest: [] });
  });
});
