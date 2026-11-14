import { buildReport } from "@/components/app/results/report-sentences";
import {
  formatCoordinate,
  formatDate,
  formatDateRange,
  formatDistance,
  formatMetricMoment,
  formatShare,
  formatValueWithUnit,
  monthName,
} from "@/lib/analysis/format";
import { SOURCE_MESSAGES } from "@/lib/analysis/sources/messages";
import {
  SOURCE_IDS,
  type AnalysisArea,
  type DateRange,
  type SourceId,
  type SourceResult,
} from "@/lib/analysis/types";
import type { Advice } from "@/lib/explain/advice";
import type { SourceResults } from "@/lib/explain/facts";
import { READING_GROUPS, type Reading } from "@/lib/explain/reading";
import { getReportDictionary } from "@/lib/i18n/app/report";
import { fill, getResultsDictionary, type ResultsDictionary } from "@/lib/i18n/app/results";
import type { Locale } from "@/lib/site";
import { REPORT_WORDS, type ReportWords } from "./words";

/**
 * The downloadable report as plain data: what it says, in order, with every
 * text already written. Drawing it is a separate step, so the content can be
 * tested without producing a PDF. Everything comes from results this server
 * computed; a value that is missing is written as missing, never as zero.
 */

export interface ReportRow {
  readonly label: string;
  readonly value: string;
}

export interface ReportTable {
  readonly title: string;
  readonly rows: readonly ReportRow[];
}

export interface ReportSection {
  readonly heading: string;
  /** What the numbers describe ("El cuadrado analizado", "La región, no tu parcela"). */
  readonly tag: string | null;
  readonly paragraphs: readonly string[];
  readonly rows: readonly ReportRow[];
  readonly tables: readonly ReportTable[];
  /** Small print: scope, source and limits. */
  readonly notes: readonly ReportRow[];
}

export interface ReportPoint {
  readonly title: string;
  readonly lines: readonly string[];
}

export interface ReportAiBlock {
  readonly heading: string;
  readonly intro: string | null;
  readonly groups: readonly { readonly heading: string | null; readonly points: readonly ReportPoint[] }[];
}

export interface PlotReport {
  readonly title: string;
  readonly generated: string;
  readonly facts: readonly ReportRow[];
  readonly ai: readonly ReportAiBlock[];
  /** Printed once under the generated blocks; `null` when there are none. */
  readonly aiNote: string | null;
  readonly sections: readonly ReportSection[];
  readonly disclaimer: string;
  readonly pageLabel: string;
}

export interface PlotReportInput {
  readonly area: AnalysisArea;
  readonly period: DateRange;
  readonly results: SourceResults;
  readonly locale: Locale;
  /** "Los Chiles, Alajuela, Costa Rica", when the place is known. */
  readonly place: string | null;
  readonly reading: Reading | null;
  readonly advice: Advice | null;
  readonly generatedAt: Date;
}

function scopeWords(result: SourceResult, area: AnalysisArea, dict: ResultsDictionary) {
  if (result.scope === "parcel") {
    return area.kind === "polygon" ? dict.scope.parcelPolygon : dict.scope.parcelBuffer;
  }
  if (result.scope === "pixel") return dict.scope.pixel;
  if (result.scope === "regional") return dict.scope.regional;
  return dict.scope.unknown;
}

function monthRows(
  months: readonly { readonly month: number; readonly value: string | null }[],
  locale: Locale,
  words: ReportWords,
): ReportRow[] {
  return months.flatMap((entry) => {
    const label = monthName(entry.month, locale);
    return label === null ? [] : [{ label, value: entry.value ?? words.noValue }];
  });
}

function tablesOf(results: SourceResults, source: SourceId, locale: Locale, words: ReportWords, dict: ResultsDictionary): ReportTable[] {
  if (source === "rain" && results.rain?.data) {
    const rows = monthRows(
      results.rain.data.climatology.map((entry) => ({
        month: entry.month,
        value: formatValueWithUnit(entry.meanMm, "mm", locale),
      })),
      locale,
      words,
    );
    return rows.length > 0 ? [{ title: words.rainByMonth, rows }] : [];
  }
  if (source === "climate" && results.climate?.data) {
    const rows = monthRows(
      results.climate.data.monthly.map((entry) => ({
        month: entry.month,
        value: formatValueWithUnit(entry.meanTemperatureC, "celsius", locale),
      })),
      locale,
      words,
    );
    return rows.length > 0 ? [{ title: words.temperatureByMonth, rows }] : [];
  }
  if (source === "terrain" && results.terrain?.data) {
    const rows = results.terrain.data.slopeClasses.map((entry) => ({
      label: `${dict.terrain.classes[entry.slopeClass]} (${
        entry.toPercent === null
          ? fill(dict.terrain.rangeFrom, { from: entry.fromPercent })
          : fill(dict.terrain.rangeBetween, { from: entry.fromPercent, to: entry.toPercent })
      })`,
      value: formatShare(entry.share, locale) ?? words.noValue,
    }));
    return rows.length > 0 ? [{ title: words.slopeClasses, rows }] : [];
  }
  return [];
}

function sectionOf(source: SourceId, input: PlotReportInput, words: ReportWords): ReportSection {
  const { results, area, locale } = input;
  const messages = SOURCE_MESSAGES[source][locale];
  const dict = getResultsDictionary(locale);
  const result = results[source] as SourceResult | undefined;
  const empty = { tables: [], rows: [], notes: [], tag: null };

  if (!result || result.status === "error") {
    return { heading: messages.title, paragraphs: [words.notAvailable], ...empty };
  }
  if (result.status !== "ok") {
    return { heading: messages.title, paragraphs: [messages.noData], ...empty };
  }

  const scope = scopeWords(result, area, dict);
  const rows = result.metrics.flatMap((metric): ReportRow[] => {
    const label = messages.metrics[metric.id]?.label;
    if (label === undefined) return [];
    const value = formatValueWithUnit(metric.value, metric.unit, locale);
    const moment = formatMetricMoment(metric.at, locale);
    return [{ label, value: value === null ? words.noValue : moment ? `${value} (${moment})` : value }];
  });
  const limitations = result.limitations
    .map((code) => messages.limitations[code])
    .filter((text): text is string => typeof text === "string");

  return {
    heading: messages.title,
    tag: scope.tag,
    paragraphs: buildReport({
      result,
      areaKind: area.kind,
      locale,
      dict: getReportDictionary(locale),
      slopeClassNames: dict.terrain.classes,
    }),
    rows,
    tables: tablesOf(results, source, locale, words, dict),
    notes: [
      { label: words.describes, value: (result.scope && messages.scope[result.scope]) ?? scope.sentence },
      {
        label: words.source,
        value: `${result.product.name} ${result.product.version}. ${fill(words.sourceLine, {
          provider: result.product.provider,
          service: result.product.accessedVia,
          resolution: formatDistance(result.product.spatialResolutionMeters, locale) ?? words.noValue,
          date: formatDate(result.retrievedAt.slice(0, 10), locale) ?? words.noValue,
        })}`,
      },
      ...limitations.map((text) => ({ label: words.limits, value: text })),
    ],
  };
}

function aiBlocks(input: PlotReportInput, words: ReportWords): ReportAiBlock[] {
  const names = (sources: readonly SourceId[]) =>
    sources.map((source) => SOURCE_MESSAGES[source][input.locale].title).join(", ");
  const groupWords = { favorable: words.favorable, alerts: words.alerts, toCheck: words.toCheck };

  const reading: ReportAiBlock[] = input.reading
    ? [
        {
          heading: words.aiReading,
          intro: input.reading.summary,
          groups: READING_GROUPS.flatMap((group) => {
            const points = input.reading?.[group] ?? [];
            return points.length === 0
              ? []
              : [
                  {
                    heading: groupWords[group],
                    points: points.map((point) => ({
                      title: point.title,
                      lines: [point.text, `${words.basedOn}: ${names(point.basedOn)}`],
                    })),
                  },
                ];
          }),
        },
      ]
    : [];

  const advice: ReportAiBlock[] = input.advice
    ? [
        {
          heading: words.aiAdvice,
          intro: null,
          groups: [
            {
              heading: null,
              points: input.advice.recommendations.map((item, index) => ({
                title: `${index + 1}. ${item.title}`,
                lines: [item.action, `${words.why}: ${item.why}`, `${words.basedOn}: ${names(item.basedOn)}`],
              })),
            },
          ],
        },
      ]
    : [];

  return [...reading, ...advice];
}

export function buildPlotReport(input: PlotReportInput): PlotReport {
  const { area, period, locale } = input;
  const words = REPORT_WORDS[locale];
  const plot = getReportDictionary(locale).plot;
  const side = formatDistance(area.bufferSideMeters, locale);
  const shape = area.kind === "buffer" && side ? fill(plot.areaSquare, { side }) : plot.areaOutline;
  const hectares = formatValueWithUnit(area.areaHectares, "ha", locale) ?? words.noValue;
  const ai = aiBlocks(input, words);

  return {
    title: words.title,
    generated: fill(words.generated, {
      date: formatDate(input.generatedAt.toISOString().slice(0, 10), locale) ?? "",
    }),
    facts: [
      ...(input.place ? [{ label: words.place, value: input.place }] : []),
      {
        label: words.coordinates,
        value: `Lat ${formatCoordinate(area.center.lat) ?? words.noValue}, Lon ${formatCoordinate(area.center.lon) ?? words.noValue}`,
      },
      { label: words.area, value: `${hectares} (${shape})` },
      { label: words.period, value: formatDateRange(period, locale) ?? words.noValue },
    ],
    ai,
    aiNote: ai.length > 0 ? words.aiNote : null,
    sections: SOURCE_IDS.map((source) => sectionOf(source, input, words)),
    disclaimer: words.disclaimer,
    pageLabel: words.page,
  };
}
