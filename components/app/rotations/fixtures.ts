import type { Analysis } from "@/lib/analysis/types";
import type { RotationComparisonResult } from "@/lib/rotation/compare";
import analysisJson from "./__fixtures__/analysis-test-area.json";
import rotationsJson from "./__fixtures__/rotations-response.json";
import rotationsGapJson from "./__fixtures__/rotations-response-rain-gap.json";

/**
 * Real answers captured from the dev server for the test area (see the
 * `note` inside the analysis fixture). The analysis is trimmed to the fields
 * this feature reads, so it is cast to the full type.
 */
export const TEST_ANALYSIS = analysisJson as unknown as Analysis;
export const ROTATIONS_BODY: unknown = rotationsJson;
export const ROTATIONS_GAP_BODY: unknown = rotationsGapJson;
export const ROTATIONS_RESULT = rotationsJson.data as unknown as RotationComparisonResult;
export const ROTATIONS_GAP_RESULT = rotationsGapJson.data as unknown as RotationComparisonResult;

export function withoutSource(analysis: Analysis, source: "rain" | "vegetation"): Analysis {
  return {
    ...analysis,
    sources: { ...analysis.sources, [source]: { ...analysis.sources[source], status: "error", data: null } },
  };
}
