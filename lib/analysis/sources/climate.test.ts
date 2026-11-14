import { afterEach, describe, expect, it, vi } from "vitest";
import { SourceError } from "../errors";
import { bufferArea } from "../geometry";
import type { Metric, SourceProgress } from "../types";
import losChilesResponse from "./__fixtures__/climate-los-chiles.json";
import {
  buildClimateUrl,
  CLIMATE_LIMITATIONS,
  CLIMATE_METRIC,
  CLIMATE_NOTE,
  CLIMATE_STAGE,
  climateSource,
  parseClimateResponse,
  parseClimatologyRange,
  summariseClimate,
} from "./climate";
import { climateMessages } from "./climate.messages";

const LOS_CHILES = { lat: 10.95, lon: -84.72 };
const PERIOD = { start: "2021-01-01", end: "2025-12-31" };
const FILL = -999;

type Parameters = (typeof losChilesResponse)["properties"]["parameter"];

function metricOf(metrics: readonly Metric[], id: string): Metric {
  const found = metrics.find((metric) => metric.id === id);
  if (!found) throw new Error(`Metric ${id} is missing.`);
  return found;
}

/** A deep copy of the real answer with its temperatures changed; the fixture stays untouched. */
function withParameters(change: (parameter: Parameters) => unknown): unknown {
  const copy = structuredClone(losChilesResponse);
  return { ...copy, properties: { ...copy.properties, parameter: change(copy.properties.parameter) } };
}

function allFill(values: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.keys(values).map((key) => [key, FILL]));
}

describe("parseClimateResponse", () => {
  it("accepts the real answer for Los Chiles", () => {
    const parsed = parseClimateResponse(losChilesResponse);
    expect(parsed.header.fill_value).toBe(FILL);
    expect(parsed.properties.parameter.T2M.ANN).toBe(26.35);
  });

  it("rejects answers with an unexpected shape", () => {
    for (const body of [null, "text", {}, { ...losChilesResponse, header: {} }, { ...losChilesResponse, geometry: { coordinates: [-84.72, 10.95] } }]) {
      expect(() => parseClimateResponse(body)).toThrowError(SourceError);
    }
  });

  it("fails rather than show a temperature under the wrong unit", () => {
    const fahrenheit = {
      ...losChilesResponse,
      parameters: { ...losChilesResponse.parameters, T2M: { ...losChilesResponse.parameters.T2M, units: "F" } },
    };
    expect(() => parseClimateResponse(fahrenheit)).toThrowError(expect.objectContaining({ code: "bad-response" }));
  });
});

describe("parseClimatologyRange", () => {
  it("reads the years from the service's own description", () => {
    expect(parseClimatologyRange(losChilesResponse.header.range)).toEqual({ start: "2001-01-01", end: "2025-12-31" });
  });

  it("ends on the real last day of the month, leap years included", () => {
    expect(parseClimatologyRange("Custom (March 1991 - February 2020)")).toEqual({ start: "1991-03-01", end: "2020-02-29" });
    expect(parseClimatologyRange("Custom (March 1991 - February 2021)")?.end).toBe("2021-02-28");
  });

  it("returns null instead of assuming a period when the text has another form", () => {
    expect(parseClimatologyRange("")).toBeNull();
    expect(parseClimatologyRange("30-year climatology")).toBeNull();
    expect(parseClimatologyRange("(Foo 2001 - Bar 2025)")).toBeNull();
  });
});

describe("summariseClimate with the real answer for Los Chiles", () => {
  const result = summariseClimate(parseClimateResponse(losChilesResponse));

  it("is regional context for the years the service states", () => {
    expect(result.status).toBe("ok");
    expect(result.scope).toBe("regional");
    expect(result.period).toEqual({ start: "2001-01-01", end: "2025-12-31" });
    expect(result.limitations).toEqual(CLIMATE_LIMITATIONS);
    // Temperatures arrive in °C and are shown in °C: nothing is converted.
    expect(result.conversions).toEqual([]);
  });

  it("reports the annual mean, the warmest and coolest month, and the cell elevation", () => {
    expect(metricOf(result.metrics, CLIMATE_METRIC.annualMean)).toEqual({
      id: CLIMATE_METRIC.annualMean,
      value: 26.35,
      unit: "celsius",
      aggregation: "mean",
    });
    expect(metricOf(result.metrics, CLIMATE_METRIC.warmestMonth)).toEqual({
      id: CLIMATE_METRIC.warmestMonth,
      value: 28.44,
      unit: "celsius",
      aggregation: "max",
      at: { month: 4 },
    });
    expect(metricOf(result.metrics, CLIMATE_METRIC.coolestMonth)).toEqual({
      id: CLIMATE_METRIC.coolestMonth,
      value: 25.15,
      unit: "celsius",
      aggregation: "min",
      at: { month: 12 },
    });
    expect(metricOf(result.metrics, CLIMATE_METRIC.gridCellElevation)).toEqual({
      id: CLIMATE_METRIC.gridCellElevation,
      value: 152.38,
      unit: "m",
      aggregation: "value",
    });
    expect(result.data.gridCellElevationMeters).toBe(152.38);
  });

  it("keeps twelve months, January first, leaving the annual value out of them", () => {
    expect(result.data.monthly).toHaveLength(12);
    expect(result.data.monthly.map((month) => month.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(result.data.monthly[0]).toEqual({ month: 1, meanTemperatureC: 25.34, maxTemperatureC: 33.64, minTemperatureC: 18.42 });
    expect(result.data.monthly[11]).toEqual({ month: 12, meanTemperatureC: 25.15, maxTemperatureC: 33.78, minTemperatureC: 18.27 });
    expect(result.quality).toEqual({ expected: 36, valid: 36, coverage: 1, notes: [] });
  });
});

describe("summariseClimate with missing values", () => {
  it("turns the fill value into missing, never into a temperature", () => {
    const body = withParameters((parameter) => ({
      ...parameter,
      T2M: { ...parameter.T2M, APR: FILL },
      T2M_MAX: { ...parameter.T2M_MAX, JAN: FILL },
    }));
    const result = summariseClimate(parseClimateResponse(body));

    expect(result.status).toBe("ok");
    expect(result.data.monthly[3].meanTemperatureC).toBeNull();
    expect(result.data.monthly[0].maxTemperatureC).toBeNull();
    expect(result.data.monthly[0].meanTemperatureC).toBe(25.34);
    expect(result.quality).toEqual({ expected: 36, valid: 34, coverage: 34 / 36, notes: [CLIMATE_NOTE.missingMonths] });
    // April is unknown, so the warmest known month is May; -999 is never the coolest.
    expect(metricOf(result.metrics, CLIMATE_METRIC.warmestMonth)).toMatchObject({ value: 27.81, at: { month: 5 } });
    expect(metricOf(result.metrics, CLIMATE_METRIC.coolestMonth)).toMatchObject({ value: 25.15, at: { month: 12 } });
  });

  it("treats a month the answer leaves out as missing", () => {
    const body = withParameters((parameter) => ({
      ...parameter,
      T2M: Object.fromEntries(Object.entries(parameter.T2M).filter(([key]) => key !== "DEC")),
    }));
    const result = summariseClimate(parseClimateResponse(body));

    expect(result.data.monthly[11].meanTemperatureC).toBeNull();
    expect(metricOf(result.metrics, CLIMATE_METRIC.coolestMonth)).toMatchObject({ value: 25.18, at: { month: 11 } });
  });

  it("answers no-data, with every temperature missing, when all values are fill", () => {
    const body = withParameters((parameter) => ({
      T2M: allFill(parameter.T2M),
      T2M_MAX: allFill(parameter.T2M_MAX),
      T2M_MIN: allFill(parameter.T2M_MIN),
    }));
    const result = summariseClimate(parseClimateResponse(body));

    expect(result.status).toBe("no-data");
    expect(metricOf(result.metrics, CLIMATE_METRIC.annualMean).value).toBeNull();
    expect(metricOf(result.metrics, CLIMATE_METRIC.warmestMonth)).toEqual({
      id: CLIMATE_METRIC.warmestMonth,
      value: null,
      unit: "celsius",
      aggregation: "max",
    });
    expect(metricOf(result.metrics, CLIMATE_METRIC.coolestMonth).value).toBeNull();
    expect(result.quality).toEqual({ expected: 36, valid: 0, coverage: 0, notes: [CLIMATE_NOTE.noTemperature] });
  });

  it("keeps a temperature of zero as a real value", () => {
    const body = withParameters((parameter) => ({ ...parameter, T2M: { ...parameter.T2M, JAN: 0, ANN: 0 } }));
    const result = summariseClimate(parseClimateResponse(body));

    expect(result.data.monthly[0].meanTemperatureC).toBe(0);
    expect(metricOf(result.metrics, CLIMATE_METRIC.annualMean).value).toBe(0);
    expect(metricOf(result.metrics, CLIMATE_METRIC.coolestMonth)).toMatchObject({ value: 0, at: { month: 1 } });
  });

  it("gives the earliest month when two tie", () => {
    const body = withParameters((parameter) => ({ ...parameter, T2M: { ...parameter.T2M, MAR: 28.44 } }));
    const result = summariseClimate(parseClimateResponse(body));
    expect(metricOf(result.metrics, CLIMATE_METRIC.warmestMonth).at).toEqual({ month: 3 });
  });

  it("reports a missing cell elevation as missing", () => {
    const body = { ...losChilesResponse, geometry: { ...losChilesResponse.geometry, coordinates: [-84.72, 10.95, FILL] } };
    const result = summariseClimate(parseClimateResponse(body));
    expect(result.data.gridCellElevationMeters).toBeNull();
    expect(metricOf(result.metrics, CLIMATE_METRIC.gridCellElevation).value).toBeNull();
  });

  it("says so when the period cannot be read or the API version changed", () => {
    const body = {
      ...losChilesResponse,
      header: { ...losChilesResponse.header, range: "A new wording", api: { ...losChilesResponse.header.api, version: "v3.0.0" } },
    };
    const result = summariseClimate(parseClimateResponse(body));

    expect(result.period).toBeNull();
    expect(result.quality.notes).toEqual([CLIMATE_NOTE.periodUnknown, CLIMATE_NOTE.apiVersionDiffers]);
  });
});

describe("climateSource", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }

  it("asks only for temperature, never for precipitation", () => {
    const url = buildClimateUrl(LOS_CHILES);
    expect(url).toBe(
      "https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,T2M_MAX,T2M_MIN&community=AG&longitude=-84.7200&latitude=10.9500&format=JSON",
    );
    expect(url).not.toMatch(/PREC/i);
  });

  it("queries the centre of the area and reports its one confirmed step", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse(losChilesResponse));
    vi.stubGlobal("fetch", fetchMock);
    const progress: SourceProgress[] = [];

    const payload = await climateSource.run({
      area: bufferArea(LOS_CHILES, 200),
      period: PERIOD,
      signal: new AbortController().signal,
      reportProgress: (step) => progress.push(step),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(buildClimateUrl(LOS_CHILES));
    expect(payload.status).toBe("ok");
    expect(progress).toEqual([{ stage: CLIMATE_STAGE.requesting }]);
  });

  it("fails with bad-response when the answer is not what the service documents", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ messages: ["something else"] })));
    await expect(
      climateSource.run({
        area: bufferArea(LOS_CHILES, 200),
        period: PERIOD,
        signal: new AbortController().signal,
        reportProgress: () => undefined,
      }),
    ).rejects.toMatchObject({ code: "bad-response" });
  });

  it("stops when the analysis is cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("Aborted", "AbortError");
      }),
    );
    await expect(
      climateSource.run({
        area: bufferArea(LOS_CHILES, 200),
        period: PERIOD,
        signal: controller.signal,
        reportProgress: () => undefined,
      }),
    ).rejects.toMatchObject({ code: "aborted" });
  });

  it("is a static regional climatology", () => {
    expect(climateSource.id).toBe("climate");
    expect(climateSource.isStatic).toBe(true);
    expect(climateSource.product.temporalResolution).toBe("climatology");
    expect(climateSource.product.version).toBe(losChilesResponse.header.api.version);
  });
});

describe("climate messages", () => {
  it.each(["es", "en"] as const)("has words in %s for every code the source emits", (locale) => {
    const messages = climateMessages[locale];
    for (const id of Object.values(CLIMATE_METRIC)) {
      expect(messages.metrics[id]?.label, id).toBeTruthy();
      expect(messages.metrics[id]?.help, id).toBeTruthy();
    }
    for (const code of CLIMATE_LIMITATIONS) expect(messages.limitations[code], code).toBeTruthy();
    for (const code of Object.values(CLIMATE_NOTE)) expect(messages.qualityNotes[code], code).toBeTruthy();
    for (const code of Object.values(CLIMATE_STAGE)) expect(messages.stages[code], code).toBeTruthy();
    expect(messages.scope.regional).toBeTruthy();
    expect(messages.title).toBeTruthy();
    expect(messages.summary).toBeTruthy();
    expect(messages.noData).toBeTruthy();
  });

  it("has the same codes in both languages", () => {
    for (const section of ["metrics", "limitations", "qualityNotes", "conversions", "stages", "scope"] as const) {
      expect(Object.keys(climateMessages.en[section]).sort()).toEqual(Object.keys(climateMessages.es[section]).sort());
    }
  });
});
