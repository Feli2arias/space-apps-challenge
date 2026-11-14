import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SourceError } from "../errors";
import { bufferArea } from "../geometry";
import type { SourceProgress } from "../types";
import losChilesResponse from "./__fixtures__/terrain-los-chiles-200m.json";
import nullAndValidResponse from "./__fixtures__/terrain-null-and-valid.json";
import { buildElevationUrl, chunk, parseElevationResponse, TERRAIN_STAGE, terrainSource } from "./terrain";
import { TERRAIN_CONVERSIONS, TERRAIN_LIMITATIONS, TERRAIN_METRIC, TERRAIN_NOTE } from "./terrain.compute";
import { terrainMessages } from "./terrain.messages";

/** The test area of the project: Los Chiles, Costa Rica. */
const LOS_CHILES = { lat: 10.95, lon: -84.72 };
const PERIOD = { start: "2021-01-01", end: "2025-12-31" };

describe("parseElevationResponse", () => {
  it("reads a real answer, keeping a missing elevation as null", () => {
    expect(parseElevationResponse(nullAndValidResponse, 2)).toEqual([null, 40]);
  });

  it("rejects an answer with a different number of points than requested", () => {
    expect(() => parseElevationResponse(nullAndValidResponse, 3)).toThrowError(
      expect.objectContaining({ code: "bad-response" }),
    );
  });

  it("rejects the error shape of the service and anything unexpected", () => {
    const invalid = { error: "Invalid interpolation method 'wrong'.", status: "INVALID_REQUEST" };
    for (const body of [invalid, null, "text", { status: "OK" }, { status: "OK", results: [{ elevation: "40" }] }]) {
      expect(() => parseElevationResponse(body, 1)).toThrowError(SourceError);
    }
  });
});

describe("buildElevationUrl and chunk", () => {
  it("writes latitude first, as the service expects", () => {
    const url = buildElevationUrl([
      [-84.72, 10.95],
      [-84.7191234567, 10.951],
    ]);
    expect(url).toBe(
      "https://api.opentopodata.org/v1/srtm30m?locations=10.950000,-84.720000|10.951000,-84.719123&interpolation=bilinear",
    );
  });

  it("splits points into batches without losing or repeating any", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 100)).toEqual([]);
  });
});

describe("terrainSource.run", () => {
  const area = bufferArea(LOS_CHILES, 200);

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }

  async function runWith(fetchMock: typeof fetch, signal = new AbortController().signal) {
    vi.stubGlobal("fetch", fetchMock);
    const progress: SourceProgress[] = [];
    const outcome = terrainSource
      .run({ area, period: PERIOD, signal, reportProgress: (step) => progress.push(step) })
      .then(
        (payload) => ({ payload, error: null }),
        (error: unknown) => ({ payload: null, error }),
      );
    await vi.runAllTimersAsync();
    return { ...(await outcome), progress };
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Let the shared one-call-per-second clock run out so tests do not affect each other.
    vi.advanceTimersByTime(60_000);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("asks for the whole grid in one call and reports only confirmed steps", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse(losChilesResponse));
    const { payload, progress } = await runWith(fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("interpolation=bilinear");
    expect(payload?.status).toBe("ok");
    expect(payload?.data.samples).toBe(36);
    expect(payload?.limitations).toEqual(TERRAIN_LIMITATIONS);
    expect(payload?.conversions).toEqual(TERRAIN_CONVERSIONS);
    expect(progress).toEqual([
      { stage: TERRAIN_STAGE.requestingElevation, completed: 0, total: 1 },
      { stage: TERRAIN_STAGE.requestingElevation, completed: 1, total: 1 },
      { stage: TERRAIN_STAGE.computingSlope },
    ]);
  });

  it("waits and tries again after a 429", async () => {
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(jsonResponse({ status: "INVALID_REQUEST" }, 429))
      .mockResolvedValue(jsonResponse(losChilesResponse));
    const { payload } = await runWith(fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(payload?.status).toBe("ok");
  });

  it("gives up with a retryable rate-limited error when the 429 persists", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 429));
    const { error } = await runWith(fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(error).toBeInstanceOf(SourceError);
    expect(error).toMatchObject({ code: "rate-limited", retryable: true, status: 429 });
    expect((error as SourceError).message).toContain("1000 calls per day");
  });

  it("does not repeat a request the service rejected as invalid", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ status: "INVALID_REQUEST", error: "bad" }, 400));
    const { error } = await runWith(fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(error).toMatchObject({ code: "upstream-error", retryable: false });
  });

  it("fails with bad-response when the answer has an unexpected shape", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ status: "OK", results: [] }));
    const { error } = await runWith(fetchMock as unknown as typeof fetch);
    expect(error).toMatchObject({ code: "bad-response" });
  });

  it("spaces out the calls of a large plot by at least one second", async () => {
    const large = bufferArea(LOS_CHILES, 2236);
    const callTimes: number[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      callTimes.push(Date.now());
      const count = String(input).split("locations=")[1].split("&")[0].split("|").length;
      const results = Array.from({ length: count }, () => ({
        dataset: "srtm30m",
        elevation: 40,
        location: { lat: 0, lng: 0 },
      }));
      return jsonResponse({ results, status: "OK" });
    });
    vi.stubGlobal("fetch", fetchMock);
    const outcome = terrainSource.run({
      area: large,
      period: PERIOD,
      signal: new AbortController().signal,
      reportProgress: () => undefined,
    });
    await vi.runAllTimersAsync();
    const payload = await outcome;

    expect(callTimes).toHaveLength(4);
    callTimes.slice(1).forEach((time, index) => {
      expect(time - callTimes[index]).toBeGreaterThanOrEqual(1_000);
    });
    expect(payload.quality.notes).toEqual([TERRAIN_NOTE.gridCoarsened]);
  });

  it("stops when the analysis is cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return jsonResponse(losChilesResponse);
    });
    const { error } = await runWith(fetchMock as unknown as typeof fetch, controller.signal);
    expect(error).toMatchObject({ code: "aborted" });
  });
});

describe("terrain source description and messages", () => {
  it("is a static parcel-level product at 30 m", () => {
    expect(terrainSource.id).toBe("terrain");
    expect(terrainSource.isStatic).toBe(true);
    expect(terrainSource.product.spatialResolutionMeters).toBe(30);
    expect(terrainSource.product.temporalResolution).toBe("static");
  });

  it.each(["es", "en"] as const)("has words in %s for every code the source emits", (locale) => {
    const messages = terrainMessages[locale];
    for (const id of Object.values(TERRAIN_METRIC)) {
      expect(messages.metrics[id]?.label, id).toBeTruthy();
      expect(messages.metrics[id]?.help, id).toBeTruthy();
    }
    for (const code of TERRAIN_LIMITATIONS) expect(messages.limitations[code], code).toBeTruthy();
    for (const code of Object.values(TERRAIN_NOTE)) expect(messages.qualityNotes[code], code).toBeTruthy();
    for (const code of TERRAIN_CONVERSIONS) expect(messages.conversions[code], code).toBeTruthy();
    for (const code of Object.values(TERRAIN_STAGE)) expect(messages.stages[code], code).toBeTruthy();
    for (const slopeClass of ["flat", "gentle", "moderate", "steep"]) {
      expect(messages.metrics[`terrain.slopeClass.${slopeClass}`]?.label).toBeTruthy();
    }
    expect(messages.scope.parcel).toBeTruthy();
    expect(messages.scope.pixel).toBeTruthy();
    expect(messages.title).toBeTruthy();
    expect(messages.summary).toBeTruthy();
    expect(messages.noData).toBeTruthy();
  });

  it("has the same codes in both languages", () => {
    for (const section of ["metrics", "limitations", "qualityNotes", "conversions", "stages", "scope"] as const) {
      expect(Object.keys(terrainMessages.en[section]).sort()).toEqual(Object.keys(terrainMessages.es[section]).sort());
    }
  });
});
