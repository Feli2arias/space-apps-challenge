import { z } from "zod";
import type { ApiError } from "@/lib/analysis/types";
import { PREVIOUS_CROPS, type PreviousCrop } from "./evidence";
import { COVER_LEVELS, type RotationPlan } from "./exposure";

/** Validation of what the browser sends to POST /api/rotations. */

export const ROTATION_LIMITS = {
  /** The challenge asks to compare at least three strategies, including the current one. */
  minPlans: 2,
  maxPlans: 4,
  /** Rainfall above this in one month is not plausible anywhere on Earth. */
  maxMonthlyRainMm: 3_000,
} as const;

const MONTHS_PER_YEAR = 12;

const planSchema = z.strictObject({
  id: z.string().trim().min(1).max(40),
  previousCrop: z.enum(PREVIOUS_CROPS),
  months: z.array(z.enum(COVER_LEVELS)).length(MONTHS_PER_YEAR),
});

const requestSchema = z.strictObject({
  baselineId: z.string().trim().min(1).max(40),
  plans: z.array(planSchema).min(ROTATION_LIMITS.minPlans).max(ROTATION_LIMITS.maxPlans),
  // `null` marks a month without rainfall data; it is not the same as zero.
  monthlyRainMm: z
    .array(z.number().min(0).max(ROTATION_LIMITS.maxMonthlyRainMm).nullable())
    .length(MONTHS_PER_YEAR),
});

export interface DeclaredRotation extends RotationPlan {
  readonly previousCrop: PreviousCrop;
}

export interface RotationRequest {
  readonly baselineId: string;
  readonly plans: readonly DeclaredRotation[];
  readonly monthlyRainMm: readonly (number | null)[];
}

type Issue = NonNullable<ApiError["issues"]>[number];

export type ParsedRotationRequest =
  | { readonly ok: true; readonly request: RotationRequest }
  | { readonly ok: false; readonly issues: readonly Issue[] };

export function parseRotationRequest(input: unknown): ParsedRotationRequest {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    };
  }

  const { plans, baselineId } = parsed.data;
  const ids = plans.map((plan) => plan.id);
  if (new Set(ids).size !== ids.length) {
    return { ok: false, issues: [{ path: "plans", message: "Each rotation needs a different id." }] };
  }
  if (!ids.includes(baselineId)) {
    return {
      ok: false,
      issues: [{ path: "baselineId", message: "The current practice must be one of the rotations." }],
    };
  }
  return { ok: true, request: parsed.data };
}
