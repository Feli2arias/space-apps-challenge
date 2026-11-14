import {
  AMACHAMIENTO_STUDY,
  evidenceFor,
  isKnownHost,
  type IncidenceObservation,
  type PreviousCrop,
} from "./evidence";
import { compareRotations, type RotationExposure } from "./exposure";
import type { RotationRequest } from "./schema";

/**
 * Puts the two readings of a rotation side by side without mixing them:
 * what the previous crop leaves behind (published evidence) and how exposed
 * the soil is to rain (model). They are kept apart on purpose, so a rotation
 * that protects the soil but has no plant-health evidence shows both facts.
 */

/** Why the soil-exposure reading could not be computed, when it could not. */
export type ExposureGap = "rain-incomplete";

export interface RotationReading {
  readonly planId: string;
  readonly previousCrop: PreviousCrop;
  /** Observations of the study for beans after this crop. Empty means "not studied". */
  readonly evidence: readonly IncidenceObservation[];
  /** Whether the study names the crop as a host of the nematode. `null` = not stated. */
  readonly knownHost: boolean | null;
  /** `null` when rainfall was incomplete; see `exposureGap`. */
  readonly exposure: RotationExposure | null;
}

export interface RotationComparisonResult {
  readonly baselineId: string;
  readonly readings: readonly RotationReading[];
  /** Share of the year's erosive rain per month, January first. `null` without rainfall. */
  readonly erosivityShares: readonly number[] | null;
  readonly exposureGap: ExposureGap | null;
  readonly study: typeof AMACHAMIENTO_STUDY;
}

export function buildRotationComparison(request: RotationRequest): RotationComparisonResult {
  const comparison = compareRotations(request.plans, request.baselineId, request.monthlyRainMm);
  const exposureById = new Map(comparison?.exposures.map((exposure) => [exposure.planId, exposure]));

  return {
    baselineId: request.baselineId,
    readings: request.plans.map((plan) => ({
      planId: plan.id,
      previousCrop: plan.previousCrop,
      evidence: evidenceFor(plan.previousCrop),
      knownHost: isKnownHost(plan.previousCrop),
      exposure: exposureById.get(plan.id) ?? null,
    })),
    erosivityShares: comparison?.erosivityShares ?? null,
    // The plans were validated already, so the only way to get no comparison is the rainfall.
    exposureGap: comparison ? null : "rain-incomplete",
    study: AMACHAMIENTO_STUDY,
  };
}
