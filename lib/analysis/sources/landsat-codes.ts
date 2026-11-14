/**
 * Every code the vegetation source can emit. The backend sends these codes and
 * the message catalogue (vegetation.messages.ts) holds their words.
 *
 * This file has no imports on purpose: the catalogue is loaded by the browser
 * and must not pull server code with it.
 */

export const VEGETATION_METRIC = {
  /** Mean of the plot NDVI over the dates that count. */
  ndviMean: "vegetation.ndviMean",
  /** Lowest and highest plot NDVI among the dates that count, with their date. */
  ndviMin: "vegetation.ndviMin",
  ndviMax: "vegetation.ndviMax",
  /** Plot NDVI of the most recent date that counts, with its date. */
  ndviLatest: "vegetation.ndviLatest",
  usableObservations: "vegetation.usableObservations",
  monthsWithoutObservation: "vegetation.monthsWithoutObservation",
  lowVegetationShare: "vegetation.lowVegetationShare",
  /** scenesFound = scenesExamined + scenesNotTier1 + scenesNotRead. */
  scenesFound: "vegetation.scenesFound",
  scenesExamined: "vegetation.scenesExamined",
  scenesNotTier1: "vegetation.scenesNotTier1",
  scenesNotRead: "vegetation.scenesNotRead",
  /** Part of scenesExamined: read, but another scene of the same date was kept. */
  scenesSameDate: "vegetation.scenesSameDate",
} as const;

export const VEGETATION_LIMITATION = {
  notADiagnosis: "ndvi-is-not-a-diagnosis",
  thresholdIsConvention: "low-vegetation-threshold-is-a-convention",
  cloudMaskCanMiss: "cloud-mask-can-miss-clouds",
  meanFavoursClearMonths: "mean-favours-clear-months",
  periodCapped: "period-capped",
  tier2NotUsed: "tier-2-scenes-not-used",
  sameDateCountedOnce: "same-date-scenes-counted-once",
  singlePixel: "single-pixel",
  edgePixelsMixed: "edge-pixels-mixed",
} as const;

export const VEGETATION_QUALITY_NOTE = {
  monthsWithoutObservation: "months-without-observation",
  scenesNotRead: "scenes-not-read",
  timeBudgetReached: "time-budget-reached",
} as const;

export const VEGETATION_CONVERSION = {
  reflectanceScaling: "reflectance-scale-and-offset",
} as const;

export const VEGETATION_STAGE = {
  searching: "searching",
  readingScenes: "reading-scenes",
} as const;

type ValueOf<T> = T[keyof T];
export type VegetationMetricId = ValueOf<typeof VEGETATION_METRIC>;
export type VegetationLimitation = ValueOf<typeof VEGETATION_LIMITATION>;
export type VegetationQualityNote = ValueOf<typeof VEGETATION_QUALITY_NOTE>;
export type VegetationConversion = ValueOf<typeof VEGETATION_CONVERSION>;
export type VegetationStage = ValueOf<typeof VEGETATION_STAGE>;
