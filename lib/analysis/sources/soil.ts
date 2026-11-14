import { z } from "zod";
import { SourceError } from "../errors";
import { requestJson } from "../http";
import type {
  AnalysisSource,
  LatLon,
  Metric,
  SoilData,
  SoilDepth,
  SoilLayer,
  SoilProperty,
  SourcePayload,
  SourceRunInput,
  Unit,
} from "../types";
import { pause } from "./pause";
import { fetchCoverageValues, type CoverageValue } from "./soil-map-service";

/**
 * Topsoil properties from SoilGrids 250m v2.0 (ISRIC), read for the pixel that
 * contains the centre of the area.
 *
 * Checked against the service's own OpenAPI description
 * (https://rest.isric.org/soilgrids/v2.0/openapi.json) and with real calls
 * (2026-11-14). The answer states, for every property, the units of the map
 * (`mapped_units`), the units after conversion (`target_units`) and the number
 * to divide by (`d_factor`); the same table is in ISRIC's "SoilGrids layers"
 * FAQ. Pixels the model does not map (urban land, inland water, glaciers and
 * bare surfaces are masked out, per the same FAQ) answer with `mean: null`.
 *
 * The REST service is slow and irregular: the same query took 5 s, 6 s, 41 s and
 * once never answered. It must never hold the rest of the analysis back.
 */

const ENDPOINT = "https://rest.isric.org/soilgrids/v2.0/properties/query";

/**
 * A healthy answer arrives in 5 to 6 seconds, but on a slow day the same
 * queries took 15, 33 and 54 seconds, and some never answered within a minute
 * (measured 14 Nov 2026). This API is therefore only the second way in: the
 * map service is asked first (see `soil-map-service.ts`).
 */
const REQUEST_TIMEOUT_MS = 30_000;
/** The first try plus one retry. */
const MAX_ATTEMPTS = 2;
const WAIT_BEFORE_RETRY_MS = 1_000;

/**
 * ISRIC's Fair Use Policy for this API: "5 API calls per 1 minute period"
 * (docs.isric.org, "SoilGrids access"). The API is a beta service without
 * guaranteed uptime.
 */
const FAIR_USE_MAX_CALLS = 5;
const FAIR_USE_WINDOW_MS = 60_000;

/** Six decimals of a degree are about 0.1 m, far finer than a 250 m pixel. */
const COORDINATE_DECIMALS = 6;

/** Mapped values are whole numbers divided by 10, so one decimal is all there is. */
const VALUE_DECIMALS = 1;

/** SoilGrids is a static map; a result stays valid for a long time (30 days). */
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;

export const SOIL_PROPERTIES: readonly SoilProperty[] = ["clay", "sand", "silt", "phh2o", "soc"];
export const SOIL_DEPTHS: readonly SoilDepth[] = ["0-5cm", "5-15cm", "15-30cm"];

/** The layer shown as headline numbers: the top 5 cm. */
const SURFACE_DEPTH: SoilDepth = "0-5cm";

interface PropertySpec {
  /** Units of the SoilGrids map, as the service states them. */
  readonly mappedUnits: string;
  /** Number the service says to divide by. */
  readonly divisor: number;
  /** Units after dividing, as the service states them. */
  readonly targetUnits: string;
  /** The same units in this app's vocabulary. */
  readonly unit: Unit;
  readonly conversion: string;
  readonly metricId: string;
}

/**
 * What the service declared for each property on 2026-11-14. The value is
 * always divided by the `d_factor` of the answer itself; this table exists so
 * that, if ISRIC ever changes a unit, the source fails instead of showing a
 * number under the wrong label.
 */
export const SOIL_PROPERTY_SPECS: Readonly<Record<SoilProperty, PropertySpec>> = {
  clay: { mappedUnits: "g/kg", divisor: 10, targetUnits: "%", unit: "percent", conversion: "texture-g-per-kg-to-percent", metricId: "soil.clay" },
  sand: { mappedUnits: "g/kg", divisor: 10, targetUnits: "%", unit: "percent", conversion: "texture-g-per-kg-to-percent", metricId: "soil.sand" },
  silt: { mappedUnits: "g/kg", divisor: 10, targetUnits: "%", unit: "percent", conversion: "texture-g-per-kg-to-percent", metricId: "soil.silt" },
  phh2o: { mappedUnits: "pH*10", divisor: 10, targetUnits: "-", unit: "pH", conversion: "ph-times-ten-to-ph", metricId: "soil.ph" },
  soc: { mappedUnits: "dg/kg", divisor: 10, targetUnits: "g/kg", unit: "g/kg", conversion: "carbon-dg-per-kg-to-g-per-kg", metricId: "soil.organicCarbon" },
};

export const SOIL_LIMITATIONS = ["modelled-estimate", "pixel-250m", "uncertainty-not-shown"] as const;

export const SOIL_NOTE = {
  /** Some of the fifteen values came back empty. */
  partialLayers: "partial-layers",
  /** The pixel is not mapped: water, a built-up area or another masked surface. */
  unmappedPixel: "unmapped-pixel",
} as const;

export const SOIL_STAGE = {
  requesting: "requesting-soil",
  reading: "reading-soil",
} as const;

const responseSchema = z.object({
  properties: z.object({
    layers: z.array(
      z.object({
        name: z.string(),
        unit_measure: z.object({
          d_factor: z.number().positive(),
          mapped_units: z.string(),
          target_units: z.string(),
        }),
        depths: z.array(
          z.object({
            label: z.string(),
            values: z.object({ mean: z.number().nullable().optional() }),
          }),
        ),
      }),
    ),
  }),
});

type ResponseLayer = z.infer<typeof responseSchema>["properties"]["layers"][number];

function roundValue(value: number): number {
  const factor = 10 ** VALUE_DECIMALS;
  return Math.round(value * factor) / factor;
}

/** Fails when the service declares other units than the ones this source labels. */
function assertDeclaredUnits(property: SoilProperty, layer: ResponseLayer): void {
  const spec = SOIL_PROPERTY_SPECS[property];
  const declared = layer.unit_measure;
  const matches =
    declared.mapped_units === spec.mappedUnits &&
    declared.target_units === spec.targetUnits &&
    declared.d_factor === spec.divisor;
  if (!matches) {
    throw new SourceError(
      "bad-response",
      `SoilGrids now declares ${property} as ${declared.mapped_units} ÷ ${declared.d_factor} → ${declared.target_units}; expected ${spec.mappedUnits} ÷ ${spec.divisor} → ${spec.targetUnits}.`,
    );
  }
}

/** One property at one depth, converted with the divisor the answer itself declares. */
function toLayer(property: SoilProperty, depth: SoilDepth, layer: ResponseLayer | undefined): SoilLayer {
  const unit = SOIL_PROPERTY_SPECS[property].unit;
  const mapped = layer?.depths.find((entry) => entry.label === depth)?.values.mean;
  if (layer === undefined || mapped === null || mapped === undefined) {
    return { property, depth, mean: null, unit };
  }
  return { property, depth, mean: roundValue(mapped / layer.unit_measure.d_factor), unit };
}

/**
 * Validates an answer of the service and returns the fifteen layers (five
 * properties at three depths), always in the same order. A value the service
 * did not give is `null`, never zero.
 */
export function parseSoilResponse(body: unknown): readonly SoilLayer[] {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) {
    throw new SourceError("bad-response", "SoilGrids answered in an unexpected format.", {
      cause: parsed.error,
    });
  }
  return SOIL_PROPERTIES.flatMap((property) => {
    const layer = parsed.data.properties.layers.find((entry) => entry.name === property);
    if (layer !== undefined) assertDeclaredUnits(property, layer);
    return SOIL_DEPTHS.map((depth) => toLayer(property, depth, layer));
  });
}

/** Turns the layers into the result: headline numbers for the top 5 cm, and data quality. */
export function summariseSoil(layers: readonly SoilLayer[]): SourcePayload<SoilData> {
  const valid = layers.filter((layer) => layer.mean !== null);
  const hasData = valid.length > 0;

  const metrics: readonly Metric[] = SOIL_PROPERTIES.map((property) => {
    const surface = layers.find((layer) => layer.property === property && layer.depth === SURFACE_DEPTH);
    const spec = SOIL_PROPERTY_SPECS[property];
    return { id: spec.metricId, value: surface?.mean ?? null, unit: spec.unit, aggregation: "value" };
  });

  const notes = !hasData
    ? [SOIL_NOTE.unmappedPixel]
    : valid.length < layers.length
      ? [SOIL_NOTE.partialLayers]
      : [];
  // Only the conversions actually applied to a value are listed.
  const conversions = [...new Set(valid.map((layer) => SOIL_PROPERTY_SPECS[layer.property].conversion))];

  return {
    status: hasData ? "ok" : "no-data",
    scope: "regional",
    period: null,
    metrics,
    data: { layers },
    quality: {
      expected: layers.length,
      valid: valid.length,
      coverage: layers.length > 0 ? valid.length / layers.length : null,
      notes,
    },
    limitations: SOIL_LIMITATIONS,
    conversions,
  };
}

export function buildSoilUrl(center: LatLon): string {
  const query = [
    `lon=${center.lon.toFixed(COORDINATE_DECIMALS)}`,
    `lat=${center.lat.toFixed(COORDINATE_DECIMALS)}`,
    ...SOIL_PROPERTIES.map((property) => `property=${property}`),
    ...SOIL_DEPTHS.map((depth) => `depth=${depth}`),
    "value=mean",
  ];
  return `${ENDPOINT}?${query.join("&")}`;
}

/**
 * Start times of the recent calls of this server process, kept to honour the
 * fair use policy. Replaced, never edited in place.
 */
let recentCallTimes: readonly number[] = [];

/** Records a call if the fair use policy still has room for it. */
function claimCall(now: number): boolean {
  const recent = recentCallTimes.filter((time) => now - time < FAIR_USE_WINDOW_MS);
  const allowed = recent.length < FAIR_USE_MAX_CALLS;
  recentCallTimes = allowed ? [...recent, now] : recent;
  return allowed;
}

async function fetchSoil(url: string, signal: AbortSignal): Promise<unknown> {
  for (let attempt = 1; ; attempt += 1) {
    if (!claimCall(Date.now())) {
      throw new SourceError(
        "rate-limited",
        "SoilGrids asks for at most 5 calls per minute (fair use policy); this server has reached that. Try again in a minute.",
      );
    }
    try {
      // Retries are counted here, not in `requestJson`, so each one is checked against the policy.
      return await requestJson(url, { timeoutMs: REQUEST_TIMEOUT_MS, retries: 0, signal });
    } catch (error) {
      const canRetry = error instanceof SourceError && error.retryable && attempt < MAX_ATTEMPTS;
      if (!canRetry) throw error;
      await pause(WAIT_BEFORE_RETRY_MS, signal);
    }
  }
}

/**
 * Writes the values of the map service in the shape of the REST answer, with
 * the units ISRIC declares for each property, so both ways in go through the
 * same validation and conversion.
 */
export function toRestShape(values: readonly CoverageValue[]): unknown {
  return {
    properties: {
      layers: SOIL_PROPERTIES.map((property) => {
        const spec = SOIL_PROPERTY_SPECS[property];
        return {
          name: property,
          unit_measure: {
            d_factor: spec.divisor,
            mapped_units: spec.mappedUnits,
            target_units: spec.targetUnits,
          },
          depths: values
            .filter((value) => value.property === property)
            .map((value) => ({ label: value.depth, values: { mean: value.mapped } })),
        };
      }),
    },
  };
}

const COVERAGES = SOIL_PROPERTIES.flatMap((property) => SOIL_DEPTHS.map((depth) => ({ property, depth })));

/** The map service first; the REST API only when the map service fails. */
async function fetchSoilBody(center: LatLon, signal: AbortSignal): Promise<unknown> {
  try {
    return toRestShape(await fetchCoverageValues(center, COVERAGES, signal));
  } catch (error) {
    // A cancelled analysis must stop here, not start a second query.
    if (signal.aborted || (error instanceof SourceError && error.code === "aborted")) throw error;
    return fetchSoil(buildSoilUrl(center), signal);
  }
}

async function run(input: SourceRunInput): Promise<SourcePayload<SoilData>> {
  input.reportProgress({ stage: SOIL_STAGE.requesting });
  const body = await fetchSoilBody(input.area.center, input.signal);
  input.reportProgress({ stage: SOIL_STAGE.reading });
  return summariseSoil(parseSoilResponse(body));
}

export const soilSource: AnalysisSource<"soil"> = {
  id: "soil",
  product: {
    id: "SoilGrids250m",
    name: "SoilGrids 250m",
    version: "2.0",
    provider: "ISRIC – World Soil Information",
    accessedVia: "ISRIC SoilGrids web services (map service at maps.isric.org; REST API v2.0 as fallback)",
    documentationUrl: "https://www.isric.org/explore/soilgrids/faq-soilgrids",
    spatialResolutionMeters: 250,
    temporalResolution: "static",
  },
  cacheVersion: 1,
  isStatic: true,
  cacheTtlSeconds: CACHE_TTL_SECONDS,
  run,
};
