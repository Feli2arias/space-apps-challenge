import { z } from "zod";
import { SourceError } from "../errors";
import { requestJson } from "../http";
import type {
  AnalysisSource,
  ClimateData,
  ClimateMonth,
  DateRange,
  LatLon,
  Metric,
  SourcePayload,
  SourceRunInput,
} from "../types";

/**
 * Temperature climatology from NASA POWER, as context for the region.
 *
 * Checked against https://power.larc.nasa.gov/docs/ and with real calls
 * (2026-11-14). The climatology endpoint answers with twelve monthly values
 * and an annual one ("ANN") per parameter, the elevation of the model's grid
 * cell as the third coordinate, and `header.fill_value` (-999) for missing
 * values.
 *
 * What the three parameters are (POWER parameter manager, AG community):
 * - T2M: "The average air (dry bulb) temperature at 2 meters above the surface".
 * - T2M_MAX / T2M_MIN: "The maximum / minimum hourly air (dry bulb) temperature
 *   at 2 meters above the surface of the earth in the period of interest".
 *   In a climatology the period of interest is the whole record, so these are
 *   the extremes of each calendar month across all its years, not the high or
 *   low of a typical day. Confirmed with the monthly series for the test
 *   point: April's T2M_MAX in the climatology (37.60 °C) equals the highest
 *   April of 2001–2025, while the mean of the 25 Aprils is 36.18 °C.
 *
 * Only temperature is read here. POWER precipitation is deliberately not
 * used: the project's research found drift in its long series, and
 * IMERG_PRECTOT returns only fill values for this place.
 */

const ENDPOINT = "https://power.larc.nasa.gov/api/temporal/climatology/point";
const PARAMETERS = ["T2M", "T2M_MAX", "T2M_MIN"] as const;

/**
 * POWER's agroclimatology community. With it the API states the unit of these
 * temperatures as "C"; the answer is checked for that before it is used.
 */
const COMMUNITY = "AG";
const EXPECTED_UNIT = "C";

/** A real call answers in under a second; 15 s means the service is stuck. */
const REQUEST_TIMEOUT_MS = 15_000;
const RETRIES = 1;

/** Four decimals of a degree are about 11 m, far finer than a cell of half a degree. */
const COORDINATE_DECIMALS = 4;

/**
 * A climatology of 25 years barely moves (when checked, its record ended in
 * December 2025), so a result is kept for a week.
 */
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Meteorological data in POWER come on the "½° latitude by ⅝° longitude grid
 * from GMAO MERRA-2" (POWER methodology docs). Half a degree of latitude is
 * about 55.6 km; the cell is wider than that east–west near the equator.
 */
const GRID_CELL_METERS = 55_600;

/** Version the API reported when this source was verified (`header.api.version`). */
const VERIFIED_API_VERSION = "v2.10.1";

const MONTH_KEYS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;
const ANNUAL_KEY = "ANN";
const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

/** Values per month: mean, highest and lowest. */
const VALUES_PER_MONTH = 3;

export const CLIMATE_METRIC = {
  annualMean: "climate.annualMeanTemperature",
  warmestMonth: "climate.warmestMonth",
  coolestMonth: "climate.coolestMonth",
  gridCellElevation: "climate.gridCellElevation",
} as const;

export const CLIMATE_LIMITATIONS = [
  "coarse-grid",
  "model-not-station",
  "grid-cell-elevation",
  "extremes-not-typical",
] as const;

export const CLIMATE_NOTE = {
  /** Some monthly values came back as the service's fill value. */
  missingMonths: "missing-months",
  /** Every temperature came back as the fill value. */
  noTemperature: "no-temperature",
  /** The years of the climatology could not be read from the answer. */
  periodUnknown: "period-unknown",
  /** The API reports another version than the one this source was verified against. */
  apiVersionDiffers: "api-version-differs",
} as const;

export const CLIMATE_STAGE = {
  requesting: "requesting-climate",
} as const;

const monthlySchema = z.record(z.string(), z.number());

const responseSchema = z.object({
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number(), z.number()]) }),
  properties: z.object({
    parameter: z.object({ T2M: monthlySchema, T2M_MAX: monthlySchema, T2M_MIN: monthlySchema }),
  }),
  header: z.object({
    fill_value: z.number(),
    range: z.string(),
    api: z.object({ version: z.string() }),
  }),
  parameters: z.object({
    T2M: z.object({ units: z.string() }),
    T2M_MAX: z.object({ units: z.string() }),
    T2M_MIN: z.object({ units: z.string() }),
  }),
});

export type ClimateResponse = z.infer<typeof responseSchema>;

export function parseClimateResponse(body: unknown): ClimateResponse {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) {
    throw new SourceError("bad-response", "NASA POWER answered in an unexpected format.", {
      cause: parsed.error,
    });
  }
  const units = PARAMETERS.map((parameter) => parsed.data.parameters[parameter].units);
  if (units.some((unit) => unit !== EXPECTED_UNIT)) {
    // Never show a temperature under the wrong unit.
    throw new SourceError(
      "bad-response",
      `NASA POWER now states the temperature units as ${units.join(", ")}; expected ${EXPECTED_UNIT}.`,
    );
  }
  return parsed.data;
}

/** A value of the answer, or `null` when it is absent or is the service's "no data" marker. */
function valueOrNull(value: number | undefined, fillValue: number): number | null {
  return value === undefined || value === fillValue ? null : value;
}

function lastDayOfMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Reads the years of the climatology from the service's own description, e.g.
 * "… Climatologies (January 2001 - December 2025)". Returns `null` when the
 * text has another form, rather than assuming a period.
 */
export function parseClimatologyRange(range: string): DateRange | null {
  const match = /\(([A-Za-z]+) (\d{4}) - ([A-Za-z]+) (\d{4})\)/.exec(range);
  if (!match) return null;
  const startMonth = MONTH_NAMES.indexOf(match[1].toLowerCase() as (typeof MONTH_NAMES)[number]) + 1;
  const endMonth = MONTH_NAMES.indexOf(match[3].toLowerCase() as (typeof MONTH_NAMES)[number]) + 1;
  if (startMonth === 0 || endMonth === 0) return null;
  const startYear = Number(match[2]);
  const endYear = Number(match[4]);
  return {
    start: `${startYear}-${pad(startMonth)}-01`,
    end: `${endYear}-${pad(endMonth)}-${pad(lastDayOfMonth(endYear, endMonth))}`,
  };
}

function toMonths(response: ClimateResponse): readonly ClimateMonth[] {
  const { T2M, T2M_MAX, T2M_MIN } = response.properties.parameter;
  const fill = response.header.fill_value;
  return MONTH_KEYS.map((key, index) => ({
    month: index + 1,
    meanTemperatureC: valueOrNull(T2M[key], fill),
    maxTemperatureC: valueOrNull(T2M_MAX[key], fill),
    minTemperatureC: valueOrNull(T2M_MIN[key], fill),
  }));
}

/** The month with the highest (or lowest) mean temperature. The earliest month wins a tie. */
function extremeMonth(months: readonly ClimateMonth[], pick: "warmest" | "coolest"): ClimateMonth | null {
  const known = months.filter((month) => month.meanTemperatureC !== null);
  if (known.length === 0) return null;
  return known.reduce((best, month) => {
    const isBetter =
      pick === "warmest"
        ? (month.meanTemperatureC as number) > (best.meanTemperatureC as number)
        : (month.meanTemperatureC as number) < (best.meanTemperatureC as number);
    return isBetter ? month : best;
  });
}

function monthMetric(id: string, month: ClimateMonth | null, aggregation: Metric["aggregation"]): Metric {
  if (month === null) return { id, value: null, unit: "celsius", aggregation };
  return { id, value: month.meanTemperatureC, unit: "celsius", aggregation, at: { month: month.month } };
}

function countValid(months: readonly ClimateMonth[]): number {
  return months
    .flatMap((month) => [month.meanTemperatureC, month.maxTemperatureC, month.minTemperatureC])
    .filter((value) => value !== null).length;
}

/** Turns a validated answer into the result. Temperatures stay in °C, as the service gives them. */
export function summariseClimate(response: ClimateResponse): SourcePayload<ClimateData> {
  const fill = response.header.fill_value;
  const monthly = toMonths(response);
  const annualMean = valueOrNull(response.properties.parameter.T2M[ANNUAL_KEY], fill);
  const gridCellElevationMeters = valueOrNull(response.geometry.coordinates[2], fill);
  const period = parseClimatologyRange(response.header.range);

  const expected = monthly.length * VALUES_PER_MONTH;
  const valid = countValid(monthly);
  const hasTemperature = monthly.some((month) => month.meanTemperatureC !== null) || annualMean !== null;

  const checks: readonly (readonly [boolean, string])[] = [
    [!hasTemperature, CLIMATE_NOTE.noTemperature],
    [hasTemperature && valid < expected, CLIMATE_NOTE.missingMonths],
    [period === null, CLIMATE_NOTE.periodUnknown],
    [response.header.api.version !== VERIFIED_API_VERSION, CLIMATE_NOTE.apiVersionDiffers],
  ];

  return {
    status: hasTemperature ? "ok" : "no-data",
    scope: "regional",
    period,
    metrics: [
      { id: CLIMATE_METRIC.annualMean, value: annualMean, unit: "celsius", aggregation: "mean" },
      monthMetric(CLIMATE_METRIC.warmestMonth, extremeMonth(monthly, "warmest"), "max"),
      monthMetric(CLIMATE_METRIC.coolestMonth, extremeMonth(monthly, "coolest"), "min"),
      { id: CLIMATE_METRIC.gridCellElevation, value: gridCellElevationMeters, unit: "m", aggregation: "value" },
    ],
    data: { monthly, gridCellElevationMeters },
    quality: {
      expected,
      valid,
      coverage: valid / expected,
      notes: checks.filter(([applies]) => applies).map(([, code]) => code),
    },
    limitations: CLIMATE_LIMITATIONS,
    conversions: [],
  };
}

export function buildClimateUrl(center: LatLon): string {
  const query = [
    `parameters=${PARAMETERS.join(",")}`,
    `community=${COMMUNITY}`,
    `longitude=${center.lon.toFixed(COORDINATE_DECIMALS)}`,
    `latitude=${center.lat.toFixed(COORDINATE_DECIMALS)}`,
    "format=JSON",
  ];
  return `${ENDPOINT}?${query.join("&")}`;
}

async function run(input: SourceRunInput): Promise<SourcePayload<ClimateData>> {
  input.reportProgress({ stage: CLIMATE_STAGE.requesting });
  const body = await requestJson(buildClimateUrl(input.area.center), {
    timeoutMs: REQUEST_TIMEOUT_MS,
    retries: RETRIES,
    signal: input.signal,
  });
  return summariseClimate(parseClimateResponse(body));
}

export const climateSource: AnalysisSource<"climate"> = {
  id: "climate",
  product: {
    id: "POWER_CLIMATOLOGY_T2M",
    name: "NASA POWER climatology: air temperature at 2 m (MERRA-2)",
    version: VERIFIED_API_VERSION,
    provider: "NASA Langley Research Center, POWER project",
    accessedVia: "NASA POWER Climatology API",
    documentationUrl: "https://power.larc.nasa.gov/docs/services/api/temporal/climatology/",
    spatialResolutionMeters: GRID_CELL_METERS,
    temporalResolution: "climatology",
  },
  cacheVersion: 1,
  isStatic: true,
  cacheTtlSeconds: CACHE_TTL_SECONDS,
  run,
};
