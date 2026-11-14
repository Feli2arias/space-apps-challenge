/**
 * TEST SCAFFOLDING — NOT PRODUCT DATA.
 *
 * Invented `Analysis` objects used only by the layout preview page
 * (/app/preview, unavailable in production) and by the panel's tests. Every
 * value is deliberately artificial (staircases, round numbers, a point in the
 * open ocean) so that nobody can mistake a screenshot of the preview for a
 * real result. Never import this file from product code.
 */

import type {
  Analysis,
  AnalysisArea,
  ClimateData,
  DateRange,
  ProductInfo,
  RainData,
  SoilData,
  SoilDepth,
  SoilProperty,
  SourceDataMap,
  SourceErrorCode,
  SourceId,
  SourceResult,
  TerrainData,
  VegetationData,
  VegetationMonth,
  VegetationObservation,
} from "@/lib/analysis/types";

const SAMPLE_PERIOD: DateRange = { start: "2021-01-01", end: "2025-12-31" };
const SAMPLE_TIMESTAMP = "2000-01-01T00:00:00.000Z";
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const SAMPLE_YEARS = [2021, 2022, 2023, 2024, 2025] as const;

/** A point in the open Atlantic: obviously not a farm. */
const SAMPLE_AREA: AnalysisArea = {
  kind: "buffer",
  center: { lat: 1.23456, lon: -1.23456 },
  polygon: {
    type: "Polygon",
    coordinates: [
      [
        [-1.2355, 1.2337],
        [-1.2337, 1.2337],
        [-1.2337, 1.2355],
        [-1.2355, 1.2355],
        [-1.2355, 1.2337],
      ],
    ],
  },
  bbox: [-1.2355, 1.2337, -1.2337, 1.2355],
  areaHectares: 4,
  bufferSideMeters: 200,
};

const SAMPLE_POLYGON_AREA: AnalysisArea = {
  ...SAMPLE_AREA,
  kind: "polygon",
  areaHectares: 12.34,
  bufferSideMeters: null,
};

function sampleProduct(source: SourceId, pixelMeters: number): ProductInfo {
  return {
    id: `SAMPLE_${source.toUpperCase()}`,
    name: `Sample product for ${source} (invented)`,
    version: "0.0",
    provider: "Nobody — invented data",
    accessedVia: "No service was called",
    documentationUrl: "https://example.com/",
    spatialResolutionMeters: pixelMeters,
    temporalResolution: source === "terrain" || source === "soil" ? "static" : "monthly",
  };
}

/* Rain: a staircase of 10, 20 … 120 mm, with April missing and January a real zero. */
const RAIN_DATA: RainData = {
  monthly: [],
  climatology: MONTHS.map((month) => {
    if (month === 4) return { month, meanMm: null, minMm: null, maxMm: null, years: 0 };
    if (month === 1) return { month, meanMm: 0, minMm: 0, maxMm: 0, years: 5 };
    return { month, meanMm: month * 10, minMm: month * 5, maxMm: month * 15, years: 5 };
  }),
  annual: SAMPLE_YEARS.map((year) => ({
    year,
    totalMm: 1000,
    validDays: 365,
    expectedDays: 365,
    complete: true,
  })),
};

/** Staircase NDVI. Every seventh month has only cloudy scenes; every fifth has no scene. */
function sampleVegetationMonth(year: number, month: number, index: number): VegetationMonth | null {
  if (index % 5 === 4) return null;
  if (index % 7 === 6) {
    return { year, month, ndviMean: null, usableObservations: 0, totalObservations: 2 };
  }
  return {
    year,
    month,
    ndviMean: month / 12 - 0.05,
    usableObservations: 1,
    totalObservations: 2,
  };
}

const VEGETATION_MONTHLY: readonly VegetationMonth[] = SAMPLE_YEARS.flatMap((year, yearIndex) =>
  MONTHS.flatMap((month) => {
    const entry = sampleVegetationMonth(year, month, yearIndex * 12 + (month - 1));
    return entry === null ? [] : [entry];
  }),
);

const VEGETATION_OBSERVATIONS: readonly VegetationObservation[] = VEGETATION_MONTHLY.flatMap(
  (entry) =>
    Array.from({ length: entry.totalObservations }, (_, sceneIndex): VegetationObservation => {
      const usable = sceneIndex < entry.usableObservations;
      const day = String(1 + sceneIndex * 16).padStart(2, "0");
      const month = String(entry.month).padStart(2, "0");
      return {
        date: `${entry.year}-${month}-${day}`,
        sceneId: `SAMPLE_SCENE_${entry.year}${month}${day}`,
        platform: sceneIndex % 2 === 0 ? "landsat-8" : "landsat-9",
        ndviMean: usable ? entry.ndviMean : null,
        ndviMin: usable ? entry.ndviMean : null,
        ndviMax: usable ? entry.ndviMean : null,
        clearPixels: usable ? 44 : 0,
        totalPixels: 44,
        sceneCloudCover: usable ? 10 : 90,
        usable,
      };
    }),
);

const VEGETATION_DATA: VegetationData = {
  observations: VEGETATION_OBSERVATIONS,
  monthly: VEGETATION_MONTHLY,
  lowVegetationThreshold: 0.25,
  minClearFraction: 0.5,
  pixelsInArea: 44,
};

const TERRAIN_DATA: TerrainData = {
  samples: 100,
  validSamples: 99,
  gridSpacingMeters: 30,
  slopeClasses: [
    { slopeClass: "flat", fromPercent: 0, toPercent: 2, share: 0.4 },
    { slopeClass: "gentle", fromPercent: 2, toPercent: 8, share: 0.3 },
    { slopeClass: "moderate", fromPercent: 8, toPercent: 15, share: 0.3 },
    { slopeClass: "steep", fromPercent: 15, toPercent: null, share: 0 },
  ],
};

const SOIL_PROPERTIES: readonly SoilProperty[] = ["clay", "sand", "silt", "phh2o", "soc"];
const SOIL_DEPTHS: readonly SoilDepth[] = ["0-5cm", "5-15cm", "15-30cm"];

/** Staircase values; the deepest organic-carbon layer is missing on purpose. */
const SOIL_DATA: SoilData = {
  layers: SOIL_PROPERTIES.flatMap((property, propertyIndex) =>
    SOIL_DEPTHS.map((depth, depthIndex) => ({
      property,
      depth,
      mean:
        property === "soc" && depth === "15-30cm" ? null : (propertyIndex + 1) * 10 + depthIndex,
      unit: property === "phh2o" ? ("pH" as const) : property === "soc" ? ("g/kg" as const) : ("percent" as const),
    })),
  ),
};

/** The grid cell sits 1000 m below the sample terrain, to trigger the altitude note. */
const CLIMATE_DATA: ClimateData = {
  monthly: MONTHS.map((month) => ({
    month,
    meanTemperatureC: 20 + month / 10,
    maxTemperatureC: 30 + month / 10,
    minTemperatureC: month === 6 ? null : 10 + month / 10,
  })),
  gridCellElevationMeters: 234,
};

type SampleResults = { readonly [K in SourceId]: SourceResult<SourceDataMap[K]> };

function okResult<K extends SourceId>(
  source: K,
  fields: Pick<SourceResult<SourceDataMap[K]>, "scope" | "metrics" | "data" | "quality"> &
    Partial<Pick<SourceResult<SourceDataMap[K]>, "limitations" | "conversions" | "fromCache">> & {
      readonly pixelMeters: number;
    },
): SourceResult<SourceDataMap[K]> {
  const { pixelMeters, ...rest } = fields;
  const product = sampleProduct(source, pixelMeters);
  return {
    source,
    status: "ok",
    product,
    period: product.temporalResolution === "static" ? null : SAMPLE_PERIOD,
    limitations: [],
    conversions: [],
    error: null,
    retrievedAt: SAMPLE_TIMESTAMP,
    fromCache: false,
    durationMs: 1234,
    ...rest,
  };
}

const COMPLETE_SOURCES: SampleResults = {
  rain: okResult("rain", {
    pixelMeters: 11000,
    scope: "regional",
    metrics: [
      { id: "sample.rain.annualMean", value: 1000, unit: "mm/year", aggregation: "mean" },
      { id: "sample.rain.wettestMonth", value: 12, unit: "month", aggregation: "max" },
      { id: "sample.rain.driestMonthTotal", value: 0, unit: "mm/month", aggregation: "min", at: { month: 1 } },
      { id: "sample.rain.notInCatalogue", value: null, unit: "mm", aggregation: "sum" },
    ],
    data: RAIN_DATA,
    quality: { expected: 1826, valid: 1800, coverage: 0.99, notes: ["sample-note", "sample-note-not-in-catalogue"] },
    limitations: ["sample-limitation", "sample-limitation-not-in-catalogue"],
    conversions: ["sample-conversion"],
    fromCache: true,
  }),
  vegetation: okResult("vegetation", {
    pixelMeters: 30,
    scope: "parcel",
    metrics: [
      { id: "sample.vegetation.latest", value: 0.5, unit: "index", aggregation: "mean", at: { date: "2025-12-01" } },
      { id: "sample.vegetation.usableScenes", value: 41, unit: "count", aggregation: "count" },
    ],
    data: VEGETATION_DATA,
    quality: { expected: null, valid: 41, coverage: null, notes: [] },
    limitations: ["sample-limitation"],
  }),
  terrain: okResult("terrain", {
    pixelMeters: 30,
    scope: "parcel",
    metrics: [
      { id: "sample.terrain.elevationMean", value: 1234, unit: "m", aggregation: "mean" },
      { id: "sample.terrain.slopeMean", value: 5.5, unit: "percent", aggregation: "mean" },
    ],
    data: TERRAIN_DATA,
    quality: { expected: 100, valid: 99, coverage: 0.99, notes: [] },
  }),
  soil: okResult("soil", {
    pixelMeters: 250,
    scope: "pixel",
    metrics: [{ id: "sample.soil.clayTop", value: 10, unit: "percent", aggregation: "value" }],
    data: SOIL_DATA,
    quality: { expected: 15, valid: 14, coverage: 14 / 15, notes: [] },
    conversions: ["sample-conversion"],
  }),
  climate: okResult("climate", {
    pixelMeters: 55000,
    scope: "regional",
    metrics: [{ id: "sample.climate.meanTemperature", value: 20.5, unit: "celsius", aggregation: "mean" }],
    data: CLIMATE_DATA,
    quality: { expected: 12, valid: 12, coverage: 1, notes: [] },
  }),
};

function failedResult<K extends SourceId>(
  source: K,
  code: SourceErrorCode,
  retryable: boolean,
): SourceResult<SourceDataMap[K]> {
  return {
    source,
    status: "error",
    product: sampleProduct(source, 30),
    scope: null,
    period: null,
    metrics: [],
    data: null,
    quality: null,
    limitations: [],
    conversions: [],
    error: {
      code,
      detail: `SAMPLE ERROR (invented): GET https://example.com/${source}?a_very_long_query_string_without_spaces=1234567890 → ${code}`,
      retryable,
    },
    retrievedAt: SAMPLE_TIMESTAMP,
    fromCache: false,
    durationMs: 30000,
  };
}

function sampleAnalysis(
  status: Analysis["status"],
  sources: SampleResults,
  area: AnalysisArea = SAMPLE_AREA,
): Analysis {
  return {
    id: `sample-${status}`,
    status,
    area,
    period: SAMPLE_PERIOD,
    requestedAt: SAMPLE_TIMESTAMP,
    completedAt: SAMPLE_TIMESTAMP,
    engineVersion: "sample",
    sources,
  };
}

/** Every source answered. */
export const SAMPLE_COMPLETE: Analysis = sampleAnalysis("complete", COMPLETE_SOURCES);

/** Rain failed (retryable) and soil answered with no valid observations. */
export const SAMPLE_PARTIAL: Analysis = sampleAnalysis(
  "partial",
  {
    ...COMPLETE_SOURCES,
    rain: failedResult("rain", "timeout", true),
    soil: {
      ...COMPLETE_SOURCES.soil,
      status: "no-data",
      metrics: [{ id: "sample.soil.clayTop", value: null, unit: "percent", aggregation: "value" }],
      data: { layers: [] },
      quality: { expected: 15, valid: 0, coverage: 0, notes: ["sample-note"] },
    },
  },
  SAMPLE_POLYGON_AREA,
);

/** Nothing worked: one retryable error, one that is not, and a code the panel does not know. */
export const SAMPLE_FAILED: Analysis = sampleAnalysis("failed", {
  rain: failedResult("rain", "network", true),
  vegetation: failedResult("vegetation", "rate-limited", true),
  terrain: failedResult("terrain", "not-configured", false),
  soil: failedResult("soil", "upstream-error", true),
  climate: failedResult("climate", "sample-unknown-code" as SourceErrorCode, true),
});

export const PREVIEW_SAMPLES = {
  complete: SAMPLE_COMPLETE,
  partial: SAMPLE_PARTIAL,
  failed: SAMPLE_FAILED,
} as const;

export type PreviewSampleName = keyof typeof PREVIEW_SAMPLES;
