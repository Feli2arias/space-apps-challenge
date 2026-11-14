/**
 * Builds the one or two plain sentences that open each source tab and each
 * row of the summary. Deterministic: a template per language filled with the
 * source's own metrics. A missing value drops its sentence (or its half of
 * one); nothing is guessed, rounded to zero or judged good or bad.
 */

import { formatNumber, formatValueWithUnit, monthName } from "@/lib/analysis/format";
import type { AreaKind, DataScope, Metric, SlopeClass, SourceId, SourceResult } from "@/lib/analysis/types";
import { fill } from "@/lib/i18n/app/results";
import type { ReportDictionary } from "@/lib/i18n/app/report";
import type { Locale } from "@/lib/site";

export interface ReportInput {
  readonly result: SourceResult<unknown>;
  readonly areaKind: AreaKind;
  readonly locale: Locale;
  readonly dict: ReportDictionary;
  /** Translated names of the slope classes, as the terrain chart writes them. */
  readonly slopeClassNames: Readonly<Record<SlopeClass, string>>;
}

type Sentences = readonly string[];

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function metricOf(result: SourceResult<unknown>, id: string): Metric | null {
  return (result.metrics ?? []).find((metric) => metric.id === id && isNumber(metric.value)) ?? null;
}

function valueOf(result: SourceResult<unknown>, id: string): number | null {
  return metricOf(result, id)?.value ?? null;
}

function monthOf(result: SourceResult<unknown>, id: string, locale: Locale): string | null {
  return monthName(metricOf(result, id)?.at?.month, locale, "long");
}

/** "dentro del cuadrado analizado", "en la región alrededor del terreno"… */
export function wherePhrase(scope: DataScope | null, areaKind: AreaKind, dict: ReportDictionary): string {
  if (scope === "parcel") return areaKind === "polygon" ? dict.where.parcelPolygon : dict.where.parcelBuffer;
  if (scope === "pixel" || scope === "regional") return dict.where[scope];
  return dict.where.unknown;
}

/** Fills a template for two optional values: both, only the first, only the second, or none. */
function pair(
  first: string | null,
  second: string | null,
  templates: { readonly both: string; readonly first: string; readonly second: string },
  keys: readonly [string, string],
): string | null {
  if (first !== null && second !== null) return fill(templates.both, { [keys[0]]: first, [keys[1]]: second });
  if (first !== null) return fill(templates.first, { [keys[0]]: first });
  if (second !== null) return fill(templates.second, { [keys[1]]: second });
  return null;
}

function compact(parts: ReadonlyArray<string | null>): Sentences {
  return parts.filter((part): part is string => part !== null);
}

function rainReport({ result, locale, dict }: ReportInput, where: string): Sentences {
  const amount = formatValueWithUnit(valueOf(result, "rain.annualMean"), "mm", locale);
  const t = dict.rain;
  return compact([
    amount === null ? null : fill(t.annual, { amount, where }),
    pair(
      monthOf(result, "rain.wettestMonth", locale),
      monthOf(result, "rain.driestMonth", locale),
      { both: t.months, first: t.wettestOnly, second: t.driestOnly },
      ["wettest", "driest"],
    ),
  ]);
}

function thresholdOf(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const value = (data as { readonly lowVegetationThreshold?: unknown }).lowVegetationThreshold;
  return isNumber(value) ? value : null;
}

function vegetationReport({ result, locale, dict }: ReportInput, where: string): Sentences {
  const t = dict.vegetation;
  // Days on which a satellite passed: the same total the chart below uses. The
  // count of images read is higher, because one pass can leave two overlapping
  // images, and mixing the two totals would look like a contradiction.
  const examined = result.quality?.expected ?? null;
  const usable = valueOf(result, "vegetation.usableObservations");
  const count = (value: number | null) => formatNumber(value, locale, 0);
  const scenes =
    usable === null
      ? null
      : examined === null
        ? fill(t.usableOnly, { usable: count(usable) ?? "", where })
        : fill(examined === 1 ? t.scenesOne : t.scenes, {
            examined: count(examined) ?? "",
            usable: count(usable) ?? "",
            where,
          });

  const share = valueOf(result, "vegetation.lowVegetationShare");
  const threshold = thresholdOf(result.data);
  let low: string | null = null;
  if (usable !== null && usable > 0 && share !== null) {
    if (share === 0) low = t.noneLow;
    else if (threshold !== null) {
      low = fill(t.someLow, {
        share: formatValueWithUnit(share, "percent", locale) ?? "",
        threshold: formatNumber(threshold, locale, 1) ?? "",
      });
    }
  }
  return compact([scenes, low]);
}

/** The slope class with the largest share; `null` when no class has a share. */
export function commonSlopeClass(data: unknown): SlopeClass | null {
  if (!data || typeof data !== "object") return null;
  const classes = (data as { readonly slopeClasses?: unknown }).slopeClasses;
  if (!Array.isArray(classes)) return null;
  let best: { readonly slopeClass: SlopeClass; readonly share: number } | null = null;
  for (const entry of classes as ReadonlyArray<{ readonly slopeClass: SlopeClass; readonly share: unknown }>) {
    if (isNumber(entry.share) && entry.share > 0 && (best === null || entry.share > best.share)) {
      best = { slopeClass: entry.slopeClass, share: entry.share };
    }
  }
  return best?.slopeClass ?? null;
}

function terrainReport({ result, locale, dict, slopeClassNames }: ReportInput, where: string): Sentences {
  const t = dict.terrain;
  const elevation = formatValueWithUnit(valueOf(result, "terrain.elevationMean"), "m", locale);
  const slope = formatValueWithUnit(valueOf(result, "terrain.slopeMeanPercent"), "percent", locale);
  const main =
    elevation !== null && slope !== null
      ? fill(t.both, { where, elevation, slope })
      : elevation !== null
        ? fill(t.elevationOnly, { where, elevation })
        : slope !== null
          ? fill(t.slopeOnly, { where, slope })
          : null;
  const common = commonSlopeClass(result.data);
  const name = common ? slopeClassNames[common]?.toLocaleLowerCase(locale) : null;
  return compact([main, name ? fill(t.commonClass, { name }) : null]);
}

/** "40 % de arcilla, 29 % de arena y 31 % de limo" with the language's own list joining. */
function joinList(items: readonly string[], locale: Locale): string {
  return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(items);
}

function phKind(ph: number, dict: ReportDictionary): string {
  if (ph < 7) return dict.soil.acid;
  return ph > 7 ? dict.soil.alkaline : dict.soil.neutral;
}

function soilReport({ result, locale, dict }: ReportInput, where: string): Sentences {
  const t = dict.soil;
  const parts = compact(
    (
      [
        ["soil.clay", t.clay],
        ["soil.sand", t.sand],
        ["soil.silt", t.silt],
      ] as const
    ).map(([id, template]) => {
      const value = formatValueWithUnit(valueOf(result, id), "percent", locale);
      return value === null ? null : fill(template, { value });
    }),
  );
  const ph = valueOf(result, "soil.ph");
  return compact([
    parts.length > 0 ? fill(t.texture, { where, parts: joinList(parts, locale) }) : null,
    ph === null ? null : fill(t.ph, { ph: formatNumber(ph, locale, 1) ?? "", kind: phKind(ph, dict) }),
  ]);
}

function climateReport({ result, locale, dict }: ReportInput, where: string): Sentences {
  const t = dict.climate;
  const mean = formatValueWithUnit(valueOf(result, "climate.annualMeanTemperature"), "celsius", locale);
  return compact([
    mean === null ? null : fill(t.mean, { where, mean }),
    pair(
      monthOf(result, "climate.warmestMonth", locale),
      monthOf(result, "climate.coolestMonth", locale),
      { both: t.months, first: t.warmestOnly, second: t.coolestOnly },
      ["warmest", "coolest"],
    ),
  ]);
}

const BUILDERS: Readonly<Record<SourceId, (input: ReportInput, where: string) => Sentences>> = {
  rain: rainReport,
  vegetation: vegetationReport,
  terrain: terrainReport,
  soil: soilReport,
  climate: climateReport,
};

/**
 * The plain sentences for one source. Empty when the source did not answer
 * with data, or when every value the sentences need is missing.
 */
export function buildReport(input: ReportInput): Sentences {
  const { result, areaKind, dict } = input;
  if (result.status !== "ok") return [];
  const builder = BUILDERS[result.source];
  return builder ? builder(input, wherePhrase(result.scope, areaKind, dict)) : [];
}
