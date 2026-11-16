import { describe, expect, it } from "vitest";
import { bufferArea } from "@/lib/analysis/geometry";
import type { RainData, SourceResult } from "@/lib/analysis/types";
import { buildFacts } from "./facts";

const area = bufferArea({ lat: 10.95, lon: -84.72 }, 200);
const period = { start: "2021-01-01", end: "2025-12-31" };

function rainResult(overrides: Partial<SourceResult<RainData>> = {}): SourceResult<RainData> {
  return {
    source: "rain",
    status: "ok",
    product: {
      id: "imerg",
      name: "GPM IMERG",
      version: "V07",
      provider: "NASA",
      spatialResolutionMeters: 11000,
    } as SourceResult["product"],
    scope: "regional",
    period,
    metrics: [{ id: "rain.annualMean", value: 2392.2, unit: "mm/year", aggregation: "mean" }],
    data: {
      monthly: [],
      annual: [],
      climatology: Array.from({ length: 12 }, (_, index) => ({
        month: index + 1,
        // February has no complete month in this made-up record.
        meanMm: index === 1 ? null : 100 + index,
        minMm: null,
        maxMm: null,
        years: 5,
      })),
    },
    quality: null,
    limitations: [],
    conversions: [],
    error: null,
    retrievedAt: "2026-11-14T00:00:00.000Z",
    fromCache: false,
    durationMs: 1,
    ...overrides,
  };
}

describe("buildFacts", () => {
  it("writes each metric with its unit and scope", () => {
    const facts = buildFacts({ rain: rainResult() }, area, period, "es");
    expect(facts.facts).toHaveLength(1);
    expect(facts.facts[0]).toMatchObject({ source: "rain", scope: "regional" });
    expect(facts.facts[0].value).toMatch(/^2[\s.]?392/);
  });

  it("adds the typical year month by month and skips months without a value", () => {
    const facts = buildFacts({ rain: rainResult() }, area, period, "es");
    expect(facts.monthly).toHaveLength(1);
    const [rain] = facts.monthly;
    expect(rain.scope).toBe("regional");
    expect(rain.months).toHaveLength(11);
    expect(rain.months[0].month).toBe("enero");
    expect(rain.months.map((entry) => entry.month)).not.toContain("febrero");
    // The monthly values may be quoted, so they are part of the allowed numbers.
    expect(facts.allowedNumbers).toContain(111);
  });

  it("allows the numbers written inside the texts the model receives", () => {
    const dated = rainResult({
      metrics: [
        { id: "rain.annualMean", value: 2392.2, unit: "mm/year", aggregation: "mean" },
        { id: "rain.wettestYear", value: 2648, unit: "mm/year", aggregation: "max", at: { year: 2025 } },
      ],
    });
    const facts = buildFacts({ rain: dated }, area, period, "es");
    // The scope note of the rain source speaks of a square of about 10 km.
    const note = facts.sources.find((brief) => brief.source === "rain")?.scopeNote ?? "";
    expect(note).toMatch(/10/);
    expect(facts.allowedNumbers).toContain(10);
  });

  it("gives no facts for a source that failed or is missing", () => {
    const failed = rainResult({ status: "error", scope: null, metrics: [], data: null });
    const facts = buildFacts({ rain: failed }, area, period, "en");
    expect(facts.facts).toEqual([]);
    expect(facts.monthly).toEqual([]);
    expect(facts.sources.find((brief) => brief.source === "rain")?.status).toBe("error");
    expect(facts.sources.find((brief) => brief.source === "soil")?.status).toBe("missing");
  });
});
