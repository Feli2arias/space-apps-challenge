/**
 * Shared contract of the terrain-analysis backend.
 *
 * Everything that crosses a boundary lives here: what the browser sends, what
 * each data source returns, and what the API streams back. The backend returns
 * numbers and codes only; the words shown to people come from each source's
 * message catalogue, so the same analysis can be read in Spanish or English.
 */

import type { Locale } from "@/lib/site";

/* ------------------------------------------------------------------ */
/* Geography                                                          */
/* ------------------------------------------------------------------ */

export interface LatLon {
  readonly lat: number;
  readonly lon: number;
}

/** A position as GeoJSON writes it: longitude first, then latitude. */
export type Position = readonly [lon: number, lat: number];

/** A closed ring: the last position repeats the first. */
export type Ring = readonly Position[];

/** [minLon, minLat, maxLon, maxLat] */
export type BoundingBox = readonly [number, number, number, number];

export interface PolygonGeometry {
  readonly type: "Polygon";
  readonly coordinates: readonly [Ring];
}

/**
 * How the analysed area was defined.
 * - "buffer": the person gave only a point, so a square of a stated size is used.
 * - "polygon": the person drew the outline of the plot.
 */
export type AreaKind = "buffer" | "polygon";

export interface AnalysisArea {
  readonly kind: AreaKind;
  /** The point the person chose, or the centroid of the drawn polygon. */
  readonly center: LatLon;
  readonly polygon: PolygonGeometry;
  readonly bbox: BoundingBox;
  readonly areaHectares: number;
  /** Side of the square in metres. Only present for "buffer" areas. */
  readonly bufferSideMeters: number | null;
}

/** Inclusive range of calendar dates, written YYYY-MM-DD. */
export interface DateRange {
  readonly start: string;
  readonly end: string;
}

/* ------------------------------------------------------------------ */
/* Sources                                                            */
/* ------------------------------------------------------------------ */

export const SOURCE_IDS = ["rain", "vegetation", "terrain", "soil", "climate"] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

/**
 * What a number describes.
 * - "parcel": a statistic computed from the pixels inside the analysed area.
 * - "pixel": the value of the single pixel that contains the chosen point.
 * - "regional": the product's pixel is larger than the area, so the value
 *   describes the surroundings and must never be shown as a plot measurement.
 */
export type DataScope = "parcel" | "pixel" | "regional";

export type TemporalResolution = "daily" | "monthly" | "per-scene" | "climatology" | "static";

export interface ProductInfo {
  /** Stable identifier, e.g. "GPM_3IMERGDL". */
  readonly id: string;
  readonly name: string;
  readonly version: string;
  /** Who produces the data, e.g. "NASA GPM". */
  readonly provider: string;
  /** The service the backend actually calls, e.g. "SERVIR ClimateSERV". */
  readonly accessedVia: string;
  /** Official documentation of the product. */
  readonly documentationUrl: string;
  /** Nominal pixel size in metres. */
  readonly spatialResolutionMeters: number;
  readonly temporalResolution: TemporalResolution;
}

export type Unit =
  | "mm"
  | "mm/year"
  | "mm/month"
  | "m"
  | "percent"
  | "degrees"
  | "celsius"
  | "index"
  | "count"
  | "month"
  | "year"
  | "ha"
  | "g/kg"
  | "pH";

export type Aggregation =
  | "mean"
  | "sum"
  | "min"
  | "max"
  | "median"
  | "count"
  | "share"
  | "coefficient-of-variation"
  | "value";

export interface Metric {
  /** Namespaced id, e.g. "rain.annualMean". Also the key of its label and help text. */
  readonly id: string;
  /** `null` means the value is missing. Zero is a real zero. */
  readonly value: number | null;
  readonly unit: Unit;
  readonly aggregation: Aggregation;
  /** When the value belongs to one moment (the wettest year, the latest scene…). */
  readonly at?: {
    readonly year?: number;
    /** 1 to 12. */
    readonly month?: number;
    readonly date?: string;
  };
}

export interface Quality {
  /** How many observations the period should contain, when that is knowable. */
  readonly expected: number | null;
  /** How many observations were usable. */
  readonly valid: number | null;
  /** valid / expected, from 0 to 1. `null` when `expected` is unknown. */
  readonly coverage: number | null;
  /** Codes of quality remarks; their text lives in the source's messages. */
  readonly notes: readonly string[];
}

export type SourceErrorCode =
  | "timeout"
  | "network"
  | "rate-limited"
  | "upstream-error"
  | "bad-response"
  | "no-coverage"
  | "aborted"
  | "not-configured"
  | "not-implemented"
  | "unexpected";

export interface SourceErrorInfo {
  readonly code: SourceErrorCode;
  /** Technical detail for logs and for the expandable "sources" section. Never shown as the headline. */
  readonly detail: string;
  readonly retryable: boolean;
}

export type SourceStatus = "ok" | "no-data" | "error";

/**
 * What a source hands back when it worked (even if it found nothing).
 * `status: "no-data"` means the service answered but there were no valid
 * observations; `data` may still describe what was looked at.
 */
export interface SourcePayload<TData> {
  readonly status: Exclude<SourceStatus, "error">;
  readonly scope: DataScope;
  /** The period the returned data actually covers. `null` for static products. */
  readonly period: DateRange | null;
  readonly metrics: readonly Metric[];
  readonly data: TData;
  readonly quality: Quality;
  /** Codes of limitations that apply to this result. */
  readonly limitations: readonly string[];
  /** Codes of unit conversions applied, so every conversion is documented. */
  readonly conversions: readonly string[];
  /**
   * True when part of the upstream queries failed (a year of rainfall, some
   * scenes), so asking again could return more. Incomplete results are shown
   * but never cached, otherwise a temporary failure would stick for days.
   */
  readonly incomplete?: boolean;
}

/** One source inside an analysis, as the API returns it. */
export interface SourceResult<TData = unknown> {
  readonly source: SourceId;
  readonly status: SourceStatus;
  readonly product: ProductInfo;
  readonly scope: DataScope | null;
  readonly period: DateRange | null;
  readonly metrics: readonly Metric[];
  readonly data: TData | null;
  readonly quality: Quality | null;
  readonly limitations: readonly string[];
  readonly conversions: readonly string[];
  readonly error: SourceErrorInfo | null;
  /** When the upstream services were actually queried (ISO 8601). */
  readonly retrievedAt: string;
  /** True when this result was read from the cache instead of queried again. */
  readonly fromCache: boolean;
  readonly durationMs: number;
}

/* ------------------------------------------------------------------ */
/* Data shapes per source                                             */
/* ------------------------------------------------------------------ */

export interface RainMonth {
  readonly year: number;
  /** 1 to 12. */
  readonly month: number;
  /** Sum of the valid days. `null` when the month has no valid day. */
  readonly totalMm: number | null;
  readonly validDays: number;
  readonly expectedDays: number;
}

export interface RainClimatologyMonth {
  /** 1 to 12. */
  readonly month: number;
  /** Mean of the monthly totals across years, using complete months only. */
  readonly meanMm: number | null;
  readonly minMm: number | null;
  readonly maxMm: number | null;
  /** How many years contributed. */
  readonly years: number;
}

export interface RainYear {
  readonly year: number;
  readonly totalMm: number | null;
  readonly validDays: number;
  readonly expectedDays: number;
  /** True when enough days are valid for the total to be comparable. */
  readonly complete: boolean;
}

export interface RainData {
  readonly monthly: readonly RainMonth[];
  /** Always 12 entries, January first. */
  readonly climatology: readonly RainClimatologyMonth[];
  readonly annual: readonly RainYear[];
}

export type LandsatPlatform = "landsat-8" | "landsat-9";

export interface VegetationObservation {
  /** Acquisition date, YYYY-MM-DD. */
  readonly date: string;
  readonly sceneId: string;
  readonly platform: LandsatPlatform;
  /** Mean NDVI of the clear pixels inside the area. `null` when none is clear. */
  readonly ndviMean: number | null;
  readonly ndviMin: number | null;
  readonly ndviMax: number | null;
  /** Pixels inside the area that passed the cloud and quality mask. */
  readonly clearPixels: number;
  /** Pixels inside the area. */
  readonly totalPixels: number;
  /** Cloud cover of the whole scene, as published in its metadata (0 to 100). */
  readonly sceneCloudCover: number | null;
  /** True when enough of the area was clear for the NDVI to count. */
  readonly usable: boolean;
}

export interface VegetationMonth {
  readonly year: number;
  /** 1 to 12. */
  readonly month: number;
  /** Mean of the usable observations in the month. `null` when there is none. */
  readonly ndviMean: number | null;
  readonly usableObservations: number;
  readonly totalObservations: number;
}

export interface VegetationData {
  /** Every scene examined, usable or not, oldest first. */
  readonly observations: readonly VegetationObservation[];
  readonly monthly: readonly VegetationMonth[];
  /** NDVI below this value is reported as "compatible with little or no vegetation". */
  readonly lowVegetationThreshold: number;
  /** Share of the area that must be clear for an observation to be usable (0 to 1). */
  readonly minClearFraction: number;
  /** Landsat pixels that fall inside the area. */
  readonly pixelsInArea: number;
}

export type SlopeClass = "flat" | "gentle" | "moderate" | "steep";

export interface SlopeClassShare {
  readonly slopeClass: SlopeClass;
  /** Lower bound of the class, in percent slope (inclusive). */
  readonly fromPercent: number;
  /** Upper bound of the class, in percent slope (exclusive). `null` means no upper bound. */
  readonly toPercent: number | null;
  /** Share of the sampled cells in this class, from 0 to 1. */
  readonly share: number;
}

export interface TerrainData {
  /** Elevation samples requested and how many came back with a value. */
  readonly samples: number;
  readonly validSamples: number;
  /** Distance between neighbouring samples, in metres. */
  readonly gridSpacingMeters: number;
  readonly slopeClasses: readonly SlopeClassShare[];
}

export type SoilProperty = "clay" | "sand" | "silt" | "phh2o" | "soc";
export type SoilDepth = "0-5cm" | "5-15cm" | "15-30cm";

export interface SoilLayer {
  readonly property: SoilProperty;
  readonly depth: SoilDepth;
  /** In the unit stated by `unit`, after conversion from the service's mapped units. */
  readonly mean: number | null;
  readonly unit: Unit;
}

export interface SoilData {
  readonly layers: readonly SoilLayer[];
}

export interface ClimateMonth {
  /** 1 to 12. */
  readonly month: number;
  readonly meanTemperatureC: number | null;
  readonly maxTemperatureC: number | null;
  readonly minTemperatureC: number | null;
}

export interface ClimateData {
  /** Always 12 entries, January first. */
  readonly monthly: readonly ClimateMonth[];
  /** Elevation the product assumes for its grid cell, in metres. */
  readonly gridCellElevationMeters: number | null;
}

export interface SourceDataMap {
  readonly rain: RainData;
  readonly vegetation: VegetationData;
  readonly terrain: TerrainData;
  readonly soil: SoilData;
  readonly climate: ClimateData;
}

/* ------------------------------------------------------------------ */
/* What a source module implements                                    */
/* ------------------------------------------------------------------ */

export interface SourceProgress {
  /** Code of the step in progress; its text lives in the source's messages (`stages`). */
  readonly stage: string;
  /** Units of work done and expected, when the source can count them (scenes, years…). */
  readonly completed?: number;
  readonly total?: number;
}

export interface SourceRunInput {
  readonly area: AnalysisArea;
  /** The period requested for time-based sources. Static sources ignore it. */
  readonly period: DateRange;
  /** Aborts when the person changes the selection or leaves. Pass it to every request. */
  readonly signal: AbortSignal;
  /** Report real progress only. Never call it with estimated or invented steps. */
  readonly reportProgress: (progress: SourceProgress) => void;
}

export interface AnalysisSource<K extends SourceId = SourceId> {
  readonly id: K;
  readonly product: ProductInfo;
  /** Bump when the output of `run` changes, so cached results are not reused. */
  readonly cacheVersion: number;
  /** True for products that ignore the requested period (terrain, soil, climatology). */
  readonly isStatic: boolean;
  /** How long a cached result stays valid. */
  readonly cacheTtlSeconds: number;
  /**
   * Queries the upstream service and computes the result.
   * Throw `SourceError` (lib/analysis/errors) for failures; return a payload with
   * `status: "no-data"` when the service answered but had nothing valid.
   */
  readonly run: (input: SourceRunInput) => Promise<SourcePayload<SourceDataMap[K]>>;
}

/** Words for one source in one language. Keys are the codes the backend emits. */
export interface SourceMessages {
  /** Short name of the topic, e.g. "Lluvia". */
  readonly title: string;
  /** One sentence on what this source tells the farmer. */
  readonly summary: string;
  /** One sentence per scope the source can return, saying what the numbers describe. */
  readonly scope: Readonly<Partial<Record<DataScope, string>>>;
  /** Metric id → label and a one-sentence plain explanation. */
  readonly metrics: Readonly<Record<string, { readonly label: string; readonly help: string }>>;
  /** Limitation code → sentence. */
  readonly limitations: Readonly<Record<string, string>>;
  /** Quality note code → sentence. */
  readonly qualityNotes: Readonly<Record<string, string>>;
  /** Conversion code → sentence documenting the unit conversion. */
  readonly conversions: Readonly<Record<string, string>>;
  /** Progress stage code → short message for the loading screen. */
  readonly stages: Readonly<Record<string, string>>;
  /** Shown when the source answered but had no valid observations. */
  readonly noData: string;
}

export type LocalizedSourceMessages = Readonly<Record<Locale, SourceMessages>>;

/* ------------------------------------------------------------------ */
/* API: request, response and stream                                  */
/* ------------------------------------------------------------------ */

/** Body of POST /api/analysis. Validated in lib/analysis/schema.ts. */
export interface AnalysisRequest {
  /** Either a point with a square size, or a drawn polygon. */
  readonly area:
    | { readonly kind: "buffer"; readonly center: LatLon; readonly sideMeters: number }
    | { readonly kind: "polygon"; readonly ring: Ring };
  /** How many full calendar years of history to analyse for time-based sources. */
  readonly years: number;
  /**
   * Sources the person asked to retry. Informational: a source that failed or
   * came back incomplete is never cached, so repeating the request already
   * queries it again, and a good cached result is never replaced.
   */
  readonly refresh?: readonly SourceId[];
}

export type AnalysisStatus = "complete" | "partial" | "failed";

export interface Analysis {
  /** Deterministic id: the same area and period always give the same id. */
  readonly id: string;
  readonly status: AnalysisStatus;
  readonly area: AnalysisArea;
  readonly period: DateRange;
  readonly requestedAt: string;
  readonly completedAt: string;
  /** Version of the analysis engine that produced this result. */
  readonly engineVersion: string;
  readonly sources: { readonly [K in SourceId]: SourceResult<SourceDataMap[K]> };
}

/**
 * POST /api/analysis answers with newline-delimited JSON, one event per line,
 * so the loading screen can show what the backend has actually confirmed.
 */
export type AnalysisEvent =
  | {
      readonly type: "accepted";
      readonly analysisId: string;
      readonly area: AnalysisArea;
      readonly period: DateRange;
      readonly sources: readonly SourceId[];
    }
  | { readonly type: "source-started"; readonly source: SourceId; readonly fromCache: boolean }
  | { readonly type: "source-progress"; readonly source: SourceId; readonly progress: SourceProgress }
  | { readonly type: "source-finished"; readonly source: SourceId; readonly result: SourceResult }
  | { readonly type: "done"; readonly analysis: Analysis }
  | { readonly type: "fatal"; readonly error: ApiError };

export type ApiErrorCode =
  | "invalid-request"
  | "rate-limited"
  | "not-found"
  | "internal";

export interface ApiError {
  readonly code: ApiErrorCode;
  readonly message: string;
  /** Field-level problems for "invalid-request". */
  readonly issues?: readonly { readonly path: string; readonly message: string }[];
}

/** Envelope of every non-streaming JSON response of the API. */
export type ApiResponse<T> =
  | { readonly success: true; readonly data: T; readonly error: null }
  | { readonly success: false; readonly data: null; readonly error: ApiError };

/* ------------------------------------------------------------------ */
/* Limits shared by the form and the validator                        */
/* ------------------------------------------------------------------ */

export const ANALYSIS_LIMITS = {
  /** Sizes offered for the square used when only a point is given. */
  bufferSidesMeters: [100, 200, 500] as const,
  defaultBufferSideMeters: 200,
  minPolygonVertices: 3,
  maxPolygonVertices: 60,
  minAreaHectares: 0.05,
  maxAreaHectares: 500,
  yearsOptions: [3, 5, 10] as const,
  defaultYears: 5,
} as const;
