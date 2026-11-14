import { LOW_VEGETATION_MAJORITY, rainCoverInsight, type RainCoverInsight } from "@/lib/analysis/insights";
import type { Analysis } from "@/lib/analysis/types";

/**
 * View model of the month strip that crosses rainfall with what clear
 * satellite scenes showed. All values come from `rainCoverInsight`; this only
 * decides how each month is drawn.
 */

export type MonthCover = "low" | "green" | "unknown";

export interface InsightMonthView {
  readonly month: number;
  readonly meanRainMm: number | null;
  /** Bar height: rainfall divided by the rainiest month (0 to 1). `null` without data. */
  readonly rainShareOfMax: number | null;
  readonly rainierThanAverage: boolean | null;
  readonly cover: MonthCover;
  readonly usableObservations: number;
  readonly coinciding: boolean;
}

export type InsightView =
  | { readonly kind: "missing"; readonly rain: boolean; readonly vegetation: boolean }
  | { readonly kind: "ok"; readonly insight: RainCoverInsight; readonly months: readonly InsightMonthView[] };

function coverOf(share: number | null): MonthCover {
  if (share === null) return "unknown";
  return share >= LOW_VEGETATION_MAJORITY ? "low" : "green";
}

export function buildInsightView(analysis: Analysis): InsightView {
  const rain = analysis.sources.rain.data;
  const vegetation = analysis.sources.vegetation.data;
  const insight = rainCoverInsight(rain, vegetation);
  if (!insight) return { kind: "missing", rain: rain === null, vegetation: vegetation === null };

  const known = insight.months.flatMap((entry) => (entry.meanRainMm === null ? [] : [entry.meanRainMm]));
  const max = known.length > 0 ? Math.max(...known) : 0;

  return {
    kind: "ok",
    insight,
    months: insight.months.map((entry) => ({
      month: entry.month,
      meanRainMm: entry.meanRainMm,
      rainShareOfMax: entry.meanRainMm === null ? null : max > 0 ? entry.meanRainMm / max : 0,
      rainierThanAverage: entry.rainierThanAverage,
      cover: coverOf(entry.lowVegetationShare),
      usableObservations: entry.usableObservations,
      coinciding: entry.rainOnLowCover === true,
    })),
  };
}
