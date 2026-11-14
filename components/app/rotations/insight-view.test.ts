import { describe, expect, it } from "vitest";
import { TEST_ANALYSIS, withoutSource } from "./fixtures";
import { buildInsightView } from "./insight-view";

describe("buildInsightView", () => {
  it("draws 12 months from the real analysis", () => {
    const view = buildInsightView(TEST_ANALYSIS);
    if (view.kind !== "ok") throw new Error("expected ok");
    expect(view.months).toHaveLength(12);
    // July is the rainiest month of the test area: its bar is full height.
    expect(view.months[6].rainShareOfMax).toBe(1);
    // August has a single clear scene across the three years: too few to judge.
    expect(view.months[7].cover).toBe("unknown");
    expect(view.months.filter((month) => month.coinciding)).toEqual([]);
  });

  it("names which source is missing and draws nothing", () => {
    expect(buildInsightView(withoutSource(TEST_ANALYSIS, "rain"))).toEqual({ kind: "missing", rain: true, vegetation: false });
    expect(buildInsightView(withoutSource(TEST_ANALYSIS, "vegetation"))).toEqual({
      kind: "missing",
      rain: false,
      vegetation: true,
    });
  });

  it("marks a rainy month with mostly low vegetation as coinciding", () => {
    const vegetation = TEST_ANALYSIS.sources.vegetation.data;
    if (!vegetation) throw new Error("fixture has vegetation");
    const lowJuly = vegetation.observations.map((observation) =>
      observation.date.slice(5, 7) === "07" ? { ...observation, ndviMean: 0.1 } : observation,
    );
    const analysis = {
      ...TEST_ANALYSIS,
      sources: {
        ...TEST_ANALYSIS.sources,
        vegetation: { ...TEST_ANALYSIS.sources.vegetation, data: { ...vegetation, observations: lowJuly } },
      },
    };
    const view = buildInsightView(analysis);
    if (view.kind !== "ok") throw new Error("expected ok");
    expect(view.months[6]).toMatchObject({ cover: "low", coinciding: true });
  });
});
