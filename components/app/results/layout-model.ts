/**
 * Pure helpers for the results dashboard: which figures each source card
 * highlights while closed, and which wait in "Otras cifras" until it is opened.
 *
 * Nothing here invents a value: a figure with no value stays `null` and is
 * written "sin dato" by the components.
 */

import type { Metric, SourceId } from "@/lib/analysis/types";

/** The figures each card highlights while closed, in display order; the first is the anchor. */
export const CARD_FIGURES: Readonly<Record<SourceId, readonly string[]>> = {
  rain: ["rain.annualMean", "rain.wettestMonth", "rain.driestMonth"],
  vegetation: ["vegetation.ndviMean", "vegetation.usableObservations", "vegetation.monthsWithoutObservation"],
  terrain: ["terrain.elevationMean", "terrain.slopeMeanPercent", "terrain.relief"],
  soil: ["soil.ph", "soil.clay", "soil.organicCarbon"],
  climate: ["climate.annualMeanTemperature", "climate.warmestMonth", "climate.coolestMonth"],
};

export interface MetricSplit {
  readonly primary: readonly Metric[];
  readonly rest: readonly Metric[];
}

/**
 * Splits a source's metrics into highlighted figures and "other figures".
 * Highlighted ones follow the order of `primaryIds`; the rest keep the order
 * the source sent. When none of the expected ids is present (a source that
 * changed its ids), the first metrics are highlighted so the card is never empty.
 */
export function splitMetrics(metrics: readonly Metric[] | null | undefined, primaryIds: readonly string[]): MetricSplit {
  const all = metrics ?? [];
  const primary = primaryIds.flatMap((id) => all.filter((metric) => metric.id === id));
  if (primary.length === 0) {
    const count = Math.max(primaryIds.length, 1);
    return { primary: all.slice(0, count), rest: all.slice(count) };
  }
  const chosen = new Set(primary.map((metric) => metric.id));
  return { primary, rest: all.filter((metric) => !chosen.has(metric.id)) };
}
