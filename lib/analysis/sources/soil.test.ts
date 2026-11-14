import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SourceError } from "../errors";
import { bufferArea } from "../geometry";
import type { SoilLayer, SourceProgress } from "../types";
import losChilesResponse from "./__fixtures__/soil-los-chiles.json";
import lakeResponse from "./__fixtures__/soil-no-data-lake-nicaragua.json";
import {
  buildSoilUrl,
  parseSoilResponse,
  SOIL_DEPTHS,
  SOIL_LIMITATIONS,
  SOIL_NOTE,
  SOIL_PROPERTIES,
  SOIL_PROPERTY_SPECS,
  SOIL_STAGE,
  soilSource,
  summariseSoil,
} from "./soil";
import { soilMessages } from "./soil.messages";

const LOS_CHILES = { lat: 10.95, lon: -84.72 };
const PERIOD = { start: "2021-01-01", end: "2025-12-31" };

function meanOf(layers: readonly SoilLayer[], property: string, depth: string): number | null {
  const found = layers.find((layer) => layer.property === property && layer.depth === depth);
  if (!found) throw new Error(`Layer ${property} ${depth} is missing.`);
  return found.mean;
}

/** A deep copy of the real answer with one change, so the fixture itself stays untouched. */
function alteredResponse(change: (layers: (typeof losChilesResponse)["properties"]["layers"]) => unknown): unknown {
  const copy = structuredClone(losChilesResponse);
  return { ...copy, properties: { ...copy.properties, layers: change(copy.properties.layers) } };
}

describe("parseSoilResponse", () => {
  it("converts the real answer for Los Chiles with the factors it declares", () => {
    const layers = parseSoilResponse(losChilesResponse);

    expect(layers).toHaveLength(15);
    // Mapped 396 g/kg ÷ 10 = 39.6 %.
    expect(meanOf(layers, "clay", "0-5cm")).toBe(39.6);
    expect(meanOf(layers, "sand", "0-5cm")).toBe(29.1);
    expect(meanOf(layers, "silt", "0-5cm")).toBe(31.3);
    // Mapped pH*10 = 53 → pH 5.3.
    expect(meanOf(layers, "phh2o", "0-5cm")).toBe(5.3);
    // Mapped 343 dg/kg ÷ 10 = 34.3 g/kg.
    expect(meanOf(layers, "soc", "0-5cm")).toBe(34.3);
    expect(meanOf(layers, "clay", "15-30cm")).toBe(44.8);
    expect(meanOf(layers, "soc", "15-30cm")).toBe(18);
  });

  it("gives sand, silt and clay that add up to about 100 %", () => {
    const layers = parseSoilResponse(losChilesResponse);
    for (const depth of SOIL_DEPTHS) {
      const total = ["clay", "sand", "silt"].reduce((sum, property) => sum + (meanOf(layers, property, depth) ?? 0), 0);
      expect(total).toBeGreaterThan(99);
      expect(total).toBeLessThan(101);
    }
  });

  it("labels every layer with this app's units, in a fixed order", () => {
    const layers = parseSoilResponse(losChilesResponse);
    expect(layers.map((layer) => `${layer.property}:${layer.depth}`)).toEqual(
      SOIL_PROPERTIES.flatMap((property) => SOIL_DEPTHS.map((depth) => `${property}:${depth}`)),
    );
    expect(layers.find((layer) => layer.property === "clay")?.unit).toBe("percent");
    expect(layers.find((layer) => layer.property === "phh2o")?.unit).toBe("pH");
    expect(layers.find((layer) => layer.property === "soc")?.unit).toBe("g/kg");
  });

  it("keeps the empty values of an unmapped pixel (a lake) as null, not zero", () => {
    const layers = parseSoilResponse(lakeResponse);
    expect(layers).toHaveLength(15);
    expect(layers.every((layer) => layer.mean === null)).toBe(true);
  });

  it("keeps a mapped zero as a real zero", () => {
    const body = alteredResponse((layers) =>
      layers.map((layer) =>
        layer.name === "soc"
          ? { ...layer, depths: layer.depths.map((depth) => ({ ...depth, values: { mean: 0 } })) }
          : layer,
      ),
    );
    expect(meanOf(parseSoilResponse(body), "soc", "0-5cm")).toBe(0);
  });

  it("marks a property or depth the service left out as missing", () => {
    const body = alteredResponse((layers) =>
      layers
        .filter((layer) => layer.name !== "silt")
        .map((layer) => (layer.name === "clay" ? { ...layer, depths: layer.depths.slice(0, 1) } : layer)),
    );
    const layers = parseSoilResponse(body);

    expect(layers).toHaveLength(15);
    expect(meanOf(layers, "silt", "0-5cm")).toBeNull();
    expect(meanOf(layers, "clay", "0-5cm")).toBe(39.6);
    expect(meanOf(layers, "clay", "5-15cm")).toBeNull();
  });

  it("fails rather than mislabel a value when the service changes its units", () => {
    const otherFactor = alteredResponse((layers) =>
      layers.map((layer) =>
        layer.name === "phh2o" ? { ...layer, unit_measure: { ...layer.unit_measure, d_factor: 100 } } : layer,
      ),
    );
    const otherUnits = alteredResponse((layers) =>
      layers.map((layer) =>
        layer.name === "soc" ? { ...layer, unit_measure: { ...layer.unit_measure, mapped_units: "g/kg" } } : layer,
      ),
    );
    for (const body of [otherFactor, otherUnits]) {
      expect(() => parseSoilResponse(body)).toThrowError(expect.objectContaining({ code: "bad-response" }));
    }
  });

  it("rejects answers with an unexpected shape", () => {
    for (const body of [null, "text", {}, { properties: {} }, { properties: { layers: [{ name: "clay" }] } }]) {
      expect(() => parseSoilResponse(body)).toThrowError(SourceError);
    }
  });
});

describe("summariseSoil", () => {
  it("reports the top 5 cm as regional values with their units", () => {
    const result = summariseSoil(parseSoilResponse(losChilesResponse));

    expect(result.status).toBe("ok");
    expect(result.scope).toBe("regional");
    expect(result.period).toBeNull();
    expect(result.metrics).toEqual([
      { id: "soil.clay", value: 39.6, unit: "percent", aggregation: "value" },
      { id: "soil.sand", value: 29.1, unit: "percent", aggregation: "value" },
      { id: "soil.silt", value: 31.3, unit: "percent", aggregation: "value" },
      { id: "soil.ph", value: 5.3, unit: "pH", aggregation: "value" },
      { id: "soil.organicCarbon", value: 34.3, unit: "g/kg", aggregation: "value" },
    ]);
    expect(result.data.layers).toHaveLength(15);
    expect(result.quality).toEqual({ expected: 15, valid: 15, coverage: 1, notes: [] });
    expect(result.limitations).toEqual(SOIL_LIMITATIONS);
    expect(result.conversions).toEqual([
      "texture-g-per-kg-to-percent",
      "ph-times-ten-to-ph",
      "carbon-dg-per-kg-to-g-per-kg",
    ]);
  });

  it("answers no-data, with every metric missing, for an unmapped pixel", () => {
    const result = summariseSoil(parseSoilResponse(lakeResponse));

    expect(result.status).toBe("no-data");
    expect(result.metrics.every((metric) => metric.value === null)).toBe(true);
    expect(result.quality).toEqual({ expected: 15, valid: 0, coverage: 0, notes: [SOIL_NOTE.unmappedPixel] });
    // No value was converted, so no conversion is claimed.
    expect(result.conversions).toEqual([]);
  });

  it("notes partial answers and lists only the conversions it applied", () => {
    const body = alteredResponse((layers) => layers.filter((layer) => layer.name === "phh2o"));
    const result = summariseSoil(parseSoilResponse(body));

    expect(result.status).toBe("ok");
    expect(result.quality.valid).toBe(3);
    expect(result.quality.coverage).toBeCloseTo(0.2, 12);
    expect(result.quality.notes).toEqual([SOIL_NOTE.partialLayers]);
    expect(result.conversions).toEqual(["ph-times-ten-to-ph"]);
    expect(result.metrics.find((metric) => metric.id === "soil.clay")?.value).toBeNull();
    expect(result.metrics.find((metric) => metric.id === "soil.ph")?.value).toBe(5.3);
  });
});

describe("buildSoilUrl", () => {
  it("asks for the five properties at three depths, mean only", () => {
    expect(buildSoilUrl(LOS_CHILES)).toBe(
      "https://rest.isric.org/soilgrids/v2.0/properties/query?lon=-84.720000&lat=10.950000" +
        "&property=clay&property=sand&property=silt&property=phh2o&property=soc" +
        "&depth=0-5cm&depth=5-15cm&depth=15-30cm&value=mean",
    );
  });
});

describe("soilSource.run", () => {
  const area = bufferArea(LOS_CHILES, 200);

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }

  /**
   * These tests are about the REST API, the second way in: the map service is
   * made to refuse every request (a status that is not retried), so the source
   * goes on to the REST API, which `fetchMock` plays.
   */
  function restOnly(fetchMock: typeof fetch): typeof fetch {
    return (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
      String(input).includes("maps.isric.org")
        ? new Response("not found", { status: 404 })
        : fetchMock(input, init)) as typeof fetch;
  }

  async function runWith(fetchMock: typeof fetch, signal = new AbortController().signal) {
    vi.stubGlobal("fetch", restOnly(fetchMock));
    const progress: SourceProgress[] = [];
    const outcome = soilSource
      .run({ area, period: PERIOD, signal, reportProgress: (step) => progress.push(step) })
      .then(
        (payload) => ({ payload, error: null }),
        (error: unknown) => ({ payload: null, error }),
      );
    await vi.runAllTimersAsync();
    return { ...(await outcome), progress };
  }

  // Each test starts two minutes after the previous one, so the one-minute
  // fair use window of the source is empty again and tests do not affect each other.
  let clock = Date.UTC(2026, 10, 14);

  beforeEach(() => {
    clock += 120_000;
    vi.useFakeTimers({ now: clock });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns the soil of the pixel at the centre of the area", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse(losChilesResponse));
    const { payload, progress } = await runWith(fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(buildSoilUrl(LOS_CHILES));
    expect(payload?.status).toBe("ok");
    expect(progress).toEqual([{ stage: SOIL_STAGE.requesting }, { stage: SOIL_STAGE.reading }]);
  });

  it("tries once more after a failure, then succeeds", async () => {
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValue(jsonResponse(losChilesResponse));
    const { payload } = await runWith(fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(payload?.status).toBe("ok");
  });

  it("fails cleanly with a retryable timeout when the service hangs twice", async () => {
    // What `fetch` does when the request's own time limit ends it.
    const fetchMock = vi.fn(async () => {
      throw new DOMException("The operation was aborted.", "AbortError");
    });
    const { error, progress } = await runWith(fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(error).toBeInstanceOf(SourceError);
    expect(error).toMatchObject({ code: "timeout", retryable: true });
    expect(progress).toEqual([{ stage: SOIL_STAGE.requesting }]);
  });

  it("does not repeat a request the service rejected", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ detail: "invalid" }, 422));
    const { error } = await runWith(fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(error).toMatchObject({ code: "upstream-error", retryable: false });
  });

  it("stops calling once the fair use limit of 5 calls per minute is reached", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(losChilesResponse));
    vi.stubGlobal("fetch", restOnly(fetchMock as unknown as typeof fetch));
    const runOnce = () =>
      soilSource.run({ area, period: PERIOD, signal: new AbortController().signal, reportProgress: () => undefined });

    for (let call = 0; call < 5; call += 1) await runOnce();
    await expect(runOnce()).rejects.toMatchObject({ code: "rate-limited", retryable: true });
    expect(fetchMock).toHaveBeenCalledTimes(5);

    // A minute later there is room again.
    vi.advanceTimersByTime(61_000);
    await expect(runOnce()).resolves.toMatchObject({ status: "ok" });
  });

  it("stops when the analysis is cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn(async () => {
      throw new DOMException("Aborted", "AbortError");
    });
    const { error } = await runWith(fetchMock as unknown as typeof fetch, controller.signal);

    // It stops before the map service and never goes on to the REST API.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(error).toMatchObject({ code: "aborted" });
  });
});

describe("soil source description and messages", () => {
  it("is a static regional product at 250 m", () => {
    expect(soilSource.id).toBe("soil");
    expect(soilSource.isStatic).toBe(true);
    expect(soilSource.product.spatialResolutionMeters).toBe(250);
  });

  it.each(["es", "en"] as const)("has words in %s for every code the source emits", (locale) => {
    const messages = soilMessages[locale];
    for (const spec of Object.values(SOIL_PROPERTY_SPECS)) {
      expect(messages.metrics[spec.metricId]?.label, spec.metricId).toBeTruthy();
      expect(messages.metrics[spec.metricId]?.help, spec.metricId).toBeTruthy();
      expect(messages.conversions[spec.conversion], spec.conversion).toBeTruthy();
    }
    for (const code of SOIL_LIMITATIONS) expect(messages.limitations[code], code).toBeTruthy();
    for (const code of Object.values(SOIL_NOTE)) expect(messages.qualityNotes[code], code).toBeTruthy();
    for (const code of Object.values(SOIL_STAGE)) expect(messages.stages[code], code).toBeTruthy();
    expect(messages.scope.regional).toBeTruthy();
    expect(messages.title).toBeTruthy();
    expect(messages.summary).toBeTruthy();
    expect(messages.noData).toBeTruthy();
  });

  it("has the same codes in both languages", () => {
    for (const section of ["metrics", "limitations", "qualityNotes", "conversions", "stages", "scope"] as const) {
      expect(Object.keys(soilMessages.en[section]).sort()).toEqual(Object.keys(soilMessages.es[section]).sort());
    }
  });
});
