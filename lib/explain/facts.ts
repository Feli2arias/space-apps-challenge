import { formatMetricMoment, formatValueWithUnit, monthName } from "@/lib/analysis/format";
import { SOURCE_MESSAGES } from "@/lib/analysis/sources/messages";
import {
  SOURCE_IDS,
  type AnalysisArea,
  type DataScope,
  type DateRange,
  type SourceDataMap,
  type SourceId,
  type SourceResult,
  type Unit,
} from "@/lib/analysis/types";
import type { Locale } from "@/lib/site";

/**
 * Turns an analysis into the short list of facts the language model is allowed
 * to talk about. The model never sees raw service responses or anything typed
 * by the visitor: only numbers this server computed, already written the way
 * the interface writes them, each with what it describes.
 */

export interface Fact {
  readonly source: SourceId;
  /** Name of the measure, as shown in the results panel. */
  readonly label: string;
  /** The value with its unit, formatted for the reader's language. */
  readonly value: string;
  /** When the value belongs to a moment: "July", "2023"… */
  readonly when: string | null;
  /** What the number describes: the plot, the pixel or the surrounding region. */
  readonly scope: DataScope;
}

export interface SourceBrief {
  readonly source: SourceId;
  readonly title: string;
  /** "ok", "no-data", "error" or "missing" (not part of this analysis). */
  readonly status: SourceResult["status"] | "missing";
  /** One sentence on what the numbers of this source describe. */
  readonly scopeNote: string | null;
  readonly limitations: readonly string[];
}

/** One value per month of the year, for the two sources that describe a typical year. */
export interface MonthlyFact {
  readonly source: SourceId;
  /** What the twelve values are, as shown in the results panel. */
  readonly label: string;
  readonly scope: DataScope;
  /** Month name and value with its unit; months without a value are left out. */
  readonly months: readonly { readonly month: string; readonly value: string }[];
}

export interface AnalysisFacts {
  readonly area: {
    readonly latitude: number;
    readonly longitude: number;
    readonly hectares: number;
    readonly definedBy: AnalysisArea["kind"];
  };
  readonly period: DateRange;
  readonly sources: readonly SourceBrief[];
  readonly facts: readonly Fact[];
  /** The typical year month by month, when rain or temperature answered. */
  readonly monthly: readonly MonthlyFact[];
  /** Every number the summary may mention; used to check the model's text. */
  readonly allowedNumbers: readonly number[];
}

export type SourceResults = { readonly [K in SourceId]?: SourceResult<SourceDataMap[K]> };

/** Limitations are kept short for the model: the two most important per source. */
const MAX_LIMITATIONS_PER_SOURCE = 2;
const COORDINATE_DECIMALS = 4;

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

/** Every calendar year a period touches, so a text may name any of them. */
function yearsOf(range: DateRange | null): number[] {
  if (!range) return [];
  const first = Number(range.start.slice(0, 4));
  const last = Number(range.end.slice(0, 4));
  if (!Number.isInteger(first) || !Number.isInteger(last) || last < first) return [];
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

function briefOf(source: SourceId, result: SourceResult | undefined, locale: Locale): SourceBrief {
  const messages = SOURCE_MESSAGES[source][locale];
  if (!result) {
    return { source, title: messages.title, status: "missing", scopeNote: null, limitations: [] };
  }
  return {
    source,
    title: messages.title,
    status: result.status,
    scopeNote: result.scope ? (messages.scope[result.scope] ?? null) : null,
    limitations: result.limitations
      .map((code) => messages.limitations[code])
      .filter((text): text is string => typeof text === "string")
      .slice(0, MAX_LIMITATIONS_PER_SOURCE),
  };
}

function factsOf(source: SourceId, result: SourceResult | undefined, locale: Locale): Fact[] {
  if (!result || result.status !== "ok" || result.scope === null) return [];
  const messages = SOURCE_MESSAGES[source][locale];
  const scope = result.scope;

  return result.metrics.flatMap((metric): Fact[] => {
    const value = formatValueWithUnit(metric.value, metric.unit, locale);
    const label = messages.metrics[metric.id]?.label;
    // A metric without a value or without a name cannot be explained honestly.
    if (value === null || label === undefined) return [];
    return [{ source, label, value, when: formatMetricMoment(metric.at, locale), scope }];
  });
}

interface MonthValue {
  readonly month: number;
  readonly value: number | null;
}

const MONTHLY_LABEL: Readonly<Record<Locale, { readonly rain: string; readonly climate: string }>> = {
  es: { rain: "Lluvia media de cada mes", climate: "Temperatura media de cada mes" },
  en: { rain: "Mean rainfall of each month", climate: "Mean temperature of each month" },
};

function monthValuesOf(results: SourceResults): { readonly rain: MonthValue[]; readonly climate: MonthValue[] } {
  const rain = results.rain?.status === "ok" ? (results.rain.data?.climatology ?? []) : [];
  const climate = results.climate?.status === "ok" ? (results.climate.data?.monthly ?? []) : [];
  return {
    rain: rain.map((entry) => ({ month: entry.month, value: entry.meanMm })),
    climate: climate.map((entry) => ({ month: entry.month, value: entry.meanTemperatureC })),
  };
}

function monthlyFact(
  source: "rain" | "climate",
  values: readonly MonthValue[],
  unit: Unit,
  scope: DataScope | null | undefined,
  locale: Locale,
): MonthlyFact[] {
  if (!scope) return [];
  const months = values.flatMap((entry) => {
    const month = monthName(entry.month, locale);
    const value = formatValueWithUnit(entry.value, unit, locale);
    return month === null || value === null ? [] : [{ month, value }];
  });
  return months.length === 0 ? [] : [{ source, label: MONTHLY_LABEL[locale][source], scope, months }];
}

function monthlyOf(results: SourceResults, locale: Locale): MonthlyFact[] {
  const values = monthValuesOf(results);
  return [
    ...monthlyFact("rain", values.rain, "mm", results.rain?.scope, locale),
    ...monthlyFact("climate", values.climate, "celsius", results.climate?.scope, locale),
  ];
}

function numbersOf(results: SourceResults, area: AnalysisArea, period: DateRange): number[] {
  const monthly = monthValuesOf(results);
  const fromMonths = [...monthly.rain, ...monthly.climate].flatMap((entry) =>
    entry.value === null ? [] : [entry.value],
  );

  const fromMetrics = SOURCE_IDS.flatMap((source) => {
    const result = results[source];
    if (!result) return [];
    return [
      ...result.metrics.flatMap((metric) => [
        ...(metric.value === null ? [] : [metric.value]),
        ...(metric.at?.year === undefined ? [] : [metric.at.year]),
      ]),
      ...yearsOf(result.period),
      result.product.spatialResolutionMeters,
      result.product.spatialResolutionMeters / 1000,
    ];
  });

  return [
    ...fromMetrics,
    ...fromMonths,
    ...yearsOf(period),
    area.areaHectares,
    area.center.lat,
    area.center.lon,
    ...(area.bufferSideMeters === null ? [] : [area.bufferSideMeters]),
  ];
}

export function buildFacts(
  results: SourceResults,
  area: AnalysisArea,
  period: DateRange,
  locale: Locale,
): AnalysisFacts {
  return {
    area: {
      latitude: round(area.center.lat, COORDINATE_DECIMALS),
      longitude: round(area.center.lon, COORDINATE_DECIMALS),
      hectares: round(area.areaHectares, 2),
      definedBy: area.kind,
    },
    period,
    sources: SOURCE_IDS.map((source) => briefOf(source, results[source], locale)),
    facts: SOURCE_IDS.flatMap((source) => factsOf(source, results[source], locale)),
    monthly: monthlyOf(results, locale),
    allowedNumbers: numbersOf(results, area, period),
  };
}
