import { describe, expect, it } from "vitest";
import { parseRotationRequest } from "@/lib/rotation/schema";
import { TEST_ANALYSIS, withoutSource } from "./fixtures";
import {
  BASELINE_ID,
  EXAMPLE_PLANS,
  buildRotationRequest,
  cycleLevel,
  isExample,
  monthlyRainFrom,
  replacePlan,
  stepLevel,
  withMonth,
  withPreviousCrop,
} from "./plans";

describe("example plans", () => {
  it("are three, current practice first, each with 12 months", () => {
    expect(EXAMPLE_PLANS.map((plan) => plan.id)).toEqual(["current", "alt-b", "alt-c"]);
    expect(EXAMPLE_PLANS[0].id).toBe(BASELINE_ID);
    EXAMPLE_PLANS.forEach((plan) => expect(plan.months).toHaveLength(12));
  });

  it("are recognised as examples until edited", () => {
    const plan = EXAMPLE_PLANS[0];
    expect(isExample(plan)).toBe(true);
    expect(isExample(withMonth(plan, 0, "high"))).toBe(false);
    expect(isExample(withPreviousCrop(plan, "rice"))).toBe(false);
  });
});

describe("level editing", () => {
  it("cycles through the four levels and wraps", () => {
    expect(cycleLevel("bare")).toBe("low");
    expect(cycleLevel("medium")).toBe("high");
    expect(cycleLevel("high")).toBe("bare");
  });

  it("steps up and down without wrapping", () => {
    expect(stepLevel("low", 1)).toBe("medium");
    expect(stepLevel("high", 1)).toBe("high");
    expect(stepLevel("bare", -1)).toBe("bare");
  });

  it("changes one month without mutating the plan", () => {
    const plan = EXAMPLE_PLANS[0];
    const next = withMonth(plan, 11, "high");
    expect(next.months[11]).toBe("high");
    expect(plan.months[11]).toBe("low");
    expect(withMonth(plan, 12, "high")).toBe(plan);
    expect(withMonth(plan, -1, "high")).toBe(plan);
  });

  it("replaces a plan by id", () => {
    const edited = withPreviousCrop(EXAMPLE_PLANS[1], "rice");
    const plans = replacePlan(EXAMPLE_PLANS, edited);
    expect(plans[1].previousCrop).toBe("rice");
    expect(EXAMPLE_PLANS[1].previousCrop).toBe("squash");
  });
});

describe("monthlyRainFrom", () => {
  it("reads the 12 monthly means of the real analysis, January first", () => {
    const rain = monthlyRainFrom(TEST_ANALYSIS);
    expect(rain).toHaveLength(12);
    expect(rain[0]).toBe(56);
    expect(rain[6]).toBe(422.2);
  });

  it("gives 12 nulls, never zeros, without a rainfall source", () => {
    expect(monthlyRainFrom(withoutSource(TEST_ANALYSIS, "rain"))).toEqual(Array(12).fill(null));
  });

  it("keeps a missing month as null and a real zero as zero", () => {
    const rainData = TEST_ANALYSIS.sources.rain.data;
    if (!rainData) throw new Error("fixture has rain");
    const climatology = rainData.climatology.map((entry) =>
      entry.month === 2 ? { ...entry, meanMm: null } : entry.month === 3 ? { ...entry, meanMm: 0 } : entry,
    );
    const analysis = {
      ...TEST_ANALYSIS,
      sources: { ...TEST_ANALYSIS.sources, rain: { ...TEST_ANALYSIS.sources.rain, data: { ...rainData, climatology } } },
    };
    const rain = monthlyRainFrom(analysis);
    expect(rain[1]).toBeNull();
    expect(rain[2]).toBe(0);
  });
});

describe("buildRotationRequest", () => {
  it("builds a request the API validator accepts", () => {
    const request = buildRotationRequest(EXAMPLE_PLANS, monthlyRainFrom(TEST_ANALYSIS));
    expect(request.baselineId).toBe("current");
    expect(parseRotationRequest(request).ok).toBe(true);
  });

  it("is still valid when rainfall is missing", () => {
    const request = buildRotationRequest(EXAMPLE_PLANS, Array(12).fill(null));
    expect(parseRotationRequest(request).ok).toBe(true);
  });
});
