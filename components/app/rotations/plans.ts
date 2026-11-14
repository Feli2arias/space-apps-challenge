import type { Analysis } from "@/lib/analysis/types";
import type { PreviousCrop } from "@/lib/rotation/evidence";
import { COVER_LEVELS, type CoverLevel } from "@/lib/rotation/exposure";
import type { RotationRequest } from "@/lib/rotation/schema";

/**
 * The three rotations the person edits, and how they become a request to
 * POST /api/rotations.
 *
 * The starting plans are illustrations only. The project has no verified
 * sowing calendar for this region, so they are not recommendations: the
 * interface labels them "editable example" until the person changes them.
 */

export const PLAN_IDS = ["current", "alt-b", "alt-c"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** The current practice is the reference every other rotation is compared against. */
export const BASELINE_ID: PlanId = "current";

const MONTHS_PER_YEAR = 12;

export interface EditablePlan {
  readonly id: PlanId;
  readonly previousCrop: PreviousCrop;
  /** Declared ground cover, January first. Always 12 entries. */
  readonly months: readonly CoverLevel[];
}

/*
 * Illustrative calendars, January first. They differ only in the previous crop
 * and in how many months the soil is left bare, so the two readings have
 * something to show. None of them is a calendar anyone has verified.
 */
export const EXAMPLE_PLANS: readonly EditablePlan[] = [
  {
    id: "current",
    previousCrop: "maize",
    months: ["bare", "bare", "bare", "bare", "low", "medium", "high", "high", "bare", "low", "medium", "low"],
  },
  {
    id: "alt-b",
    previousCrop: "squash",
    months: ["low", "low", "bare", "bare", "low", "medium", "high", "medium", "low", "low", "medium", "low"],
  },
  {
    id: "alt-c",
    previousCrop: "cover-crop",
    months: ["medium", "medium", "low", "low", "medium", "high", "high", "high", "medium", "low", "medium", "medium"],
  },
];

function exampleFor(id: PlanId): EditablePlan | undefined {
  return EXAMPLE_PLANS.find((plan) => plan.id === id);
}

/** True while the plan is still exactly the illustrative example. */
export function isExample(plan: EditablePlan): boolean {
  const example = exampleFor(plan.id);
  return (
    example !== undefined &&
    example.previousCrop === plan.previousCrop &&
    example.months.every((level, index) => plan.months[index] === level)
  );
}

/** Next level in the cycle bare → low → medium → high → bare (used by a tap). */
export function cycleLevel(level: CoverLevel): CoverLevel {
  const index = COVER_LEVELS.indexOf(level);
  return COVER_LEVELS[(index + 1) % COVER_LEVELS.length];
}

/** One level up or down, stopping at the ends (used by the arrow keys). */
export function stepLevel(level: CoverLevel, step: 1 | -1): CoverLevel {
  const index = COVER_LEVELS.indexOf(level) + step;
  return COVER_LEVELS[Math.min(Math.max(index, 0), COVER_LEVELS.length - 1)];
}

export function withMonth(plan: EditablePlan, monthIndex: number, level: CoverLevel): EditablePlan {
  if (monthIndex < 0 || monthIndex >= MONTHS_PER_YEAR) return plan;
  return { ...plan, months: plan.months.map((current, index) => (index === monthIndex ? level : current)) };
}

export function withPreviousCrop(plan: EditablePlan, previousCrop: PreviousCrop): EditablePlan {
  return { ...plan, previousCrop };
}

export function replacePlan(plans: readonly EditablePlan[], next: EditablePlan): readonly EditablePlan[] {
  return plans.map((plan) => (plan.id === next.id ? next : plan));
}

/**
 * Mean rainfall per calendar month from the analysis, January first.
 * `null` marks a month without data (or no rainfall source at all): it is
 * never turned into zero.
 */
export function monthlyRainFrom(analysis: Analysis): readonly (number | null)[] {
  const climatology = analysis.sources.rain.data?.climatology ?? [];
  const byMonth = new Map(climatology.map((entry) => [entry.month, entry.meanMm]));
  return Array.from({ length: MONTHS_PER_YEAR }, (_, index) => {
    const value = byMonth.get(index + 1);
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
  });
}

export function buildRotationRequest(
  plans: readonly EditablePlan[],
  monthlyRainMm: readonly (number | null)[],
): RotationRequest {
  return {
    baselineId: BASELINE_ID,
    plans: plans.map((plan) => ({ id: plan.id, previousCrop: plan.previousCrop, months: [...plan.months] })),
    monthlyRainMm: [...monthlyRainMm],
  };
}
