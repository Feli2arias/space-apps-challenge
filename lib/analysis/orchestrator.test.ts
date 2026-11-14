import { describe, expect, it } from "vitest";
import { MemoryCache } from "./cache";
import { SourceError } from "./errors";
import { bufferArea } from "./geometry";
import { analysisId, runAnalysis, type SourceRegistry } from "./orchestrator";
import type {
  AnalysisEvent,
  AnalysisRequest,
  AnalysisSource,
  ProductInfo,
  SourceDataMap,
  SourceId,
  SourcePayload,
} from "./types";

const AREA = bufferArea({ lat: 10.95, lon: -84.72 }, 200);
const REQUEST: AnalysisRequest = {
  area: { kind: "buffer", center: AREA.center, sideMeters: 200 },
  years: 5,
};
const NOW = new Date("2026-11-14T12:00:00Z");

const EMPTY: SourceDataMap = {
  rain: { monthly: [], climatology: [], annual: [] },
  vegetation: {
    observations: [],
    monthly: [],
    lowVegetationThreshold: 0.2,
    minClearFraction: 0.5,
    pixelsInArea: 0,
  },
  terrain: { samples: 0, validSamples: 0, gridSpacingMeters: 0, slopeClasses: [] },
  soil: { layers: [] },
  climate: { monthly: [], gridCellElevationMeters: null },
};

function product(id: string): ProductInfo {
  return {
    id,
    name: id,
    version: "test",
    provider: "test",
    accessedVia: "test",
    documentationUrl: "https://example.test",
    spatialResolutionMeters: 30,
    temporalResolution: "static",
  };
}

type Behaviour = "ok" | "no-data" | "fail" | "progress" | "incomplete";

/** A source double that counts its calls and behaves as told. */
function fakeSource<K extends SourceId>(id: K, behaviour: Behaviour, calls: SourceId[]): AnalysisSource<K> {
  return {
    id,
    product: product(id),
    cacheVersion: 1,
    isStatic: id === "terrain" || id === "soil" || id === "climate",
    cacheTtlSeconds: 3600,
    run: async (input) => {
      calls.push(id);
      if (behaviour === "fail") throw new SourceError("upstream-error", `${id} is down`, { status: 503 });
      if (behaviour === "progress") input.reportProgress({ stage: "working", completed: 1, total: 2 });
      const payload: SourcePayload<SourceDataMap[K]> = {
        status: behaviour === "no-data" ? "no-data" : "ok",
        scope: "parcel",
        period: null,
        metrics: [{ id: `${id}.value`, value: 0, unit: "count", aggregation: "value" }],
        data: EMPTY[id],
        quality: { expected: null, valid: null, coverage: null, notes: [] },
        limitations: [],
        conversions: [],
        incomplete: behaviour === "incomplete",
      };
      return payload;
    },
  };
}

function registry(behaviours: Partial<Record<SourceId, Behaviour>>, calls: SourceId[]): SourceRegistry {
  const pick = (id: SourceId): Behaviour => behaviours[id] ?? "ok";
  return {
    rain: fakeSource("rain", pick("rain"), calls),
    vegetation: fakeSource("vegetation", pick("vegetation"), calls),
    terrain: fakeSource("terrain", pick("terrain"), calls),
    soil: fakeSource("soil", pick("soil"), calls),
    climate: fakeSource("climate", pick("climate"), calls),
  };
}

function run(
  behaviours: Partial<Record<SourceId, Behaviour>>,
  overrides: { cache?: MemoryCache; request?: AnalysisRequest; calls?: SourceId[] } = {},
) {
  const events: AnalysisEvent[] = [];
  const calls = overrides.calls ?? [];
  const promise = runAnalysis({
    request: overrides.request ?? REQUEST,
    area: AREA,
    sources: registry(behaviours, calls),
    cache: overrides.cache ?? new MemoryCache(),
    signal: new AbortController().signal,
    emit: (event) => events.push(event),
    now: () => NOW,
  });
  return { promise, events, calls };
}

describe("runAnalysis", () => {
  it("is complete when every source answers", async () => {
    const { promise, events } = run({});
    const analysis = await promise;
    expect(analysis.status).toBe("complete");
    expect(analysis.period).toEqual({ start: "2021-01-01", end: "2025-12-31" });
    expect(Object.values(analysis.sources).every((source) => source.status === "ok")).toBe(true);
    expect(events[0].type).toBe("accepted");
    expect(events.at(-1)).toEqual({ type: "done", analysis });
  });

  it("is partial when some sources fail, and keeps the ones that worked", async () => {
    const analysis = await run({ rain: "fail" }).promise;
    expect(analysis.status).toBe("partial");
    expect(analysis.sources.rain.status).toBe("error");
    expect(analysis.sources.rain.error).toEqual({
      code: "upstream-error",
      detail: "rain is down",
      retryable: true,
    });
    expect(analysis.sources.rain.data).toBeNull();
    expect(analysis.sources.terrain.status).toBe("ok");
  });

  it("is failed only when every source fails", async () => {
    const analysis = await run({
      rain: "fail",
      vegetation: "fail",
      terrain: "fail",
      soil: "fail",
      climate: "fail",
    }).promise;
    expect(analysis.status).toBe("failed");
  });

  it("counts a source without data as answered, not as failed", async () => {
    const analysis = await run({ vegetation: "no-data" }).promise;
    expect(analysis.status).toBe("complete");
    expect(analysis.sources.vegetation.status).toBe("no-data");
  });

  it("keeps a real zero as zero", async () => {
    const analysis = await run({}).promise;
    expect(analysis.sources.terrain.metrics[0].value).toBe(0);
  });

  it("emits started and finished for each source, and its progress in between", async () => {
    const { promise, events } = run({ vegetation: "progress" });
    await promise;
    const ofVegetation = events.filter((event) => "source" in event && event.source === "vegetation");
    expect(ofVegetation.map((event) => event.type)).toEqual([
      "source-started",
      "source-progress",
      "source-finished",
    ]);
    expect(events.filter((event) => event.type === "source-finished")).toHaveLength(5);
  });

  it("answers from the cache the second time and says so", async () => {
    const cache = new MemoryCache();
    const calls: SourceId[] = [];
    const first = await run({}, { cache, calls }).promise;
    const second = await run({}, { cache, calls }).promise;
    expect(calls).toHaveLength(5);
    expect(first.sources.rain.fromCache).toBe(false);
    expect(second.sources.rain.fromCache).toBe(true);
    expect(second.sources.rain.retrievedAt).toBe(first.sources.rain.retrievedAt);
    expect(second.id).toBe(first.id);
  });

  it("does not cache failures, so the next run asks again", async () => {
    const cache = new MemoryCache();
    const calls: SourceId[] = [];
    await run({ rain: "fail" }, { cache, calls }).promise;
    const retry = await run({}, { cache, calls }).promise;
    expect(calls.filter((id) => id === "rain")).toHaveLength(2);
    expect(retry.sources.rain.status).toBe("ok");
    expect(retry.sources.rain.fromCache).toBe(false);
  });

  it("shows an incomplete answer but does not keep it, so the next run asks again", async () => {
    const cache = new MemoryCache();
    const calls: SourceId[] = [];
    const first = await run({ rain: "incomplete" }, { cache, calls }).promise;
    expect(first.sources.rain.status).toBe("ok");
    const second = await run({}, { cache, calls }).promise;
    expect(calls.filter((id) => id === "rain")).toHaveLength(2);
    expect(second.sources.rain.fromCache).toBe(false);
    expect(second.sources.terrain.fromCache).toBe(true);
  });

  it("retries a failed source when the request is repeated, and nothing else", async () => {
    const cache = new MemoryCache();
    const calls: SourceId[] = [];
    await run({ soil: "fail" }, { cache, calls }).promise;
    const retried = await run({}, { cache, calls, request: { ...REQUEST, refresh: ["soil"] } }).promise;
    expect(calls.filter((id) => id === "soil")).toHaveLength(2);
    expect(calls.filter((id) => id === "rain")).toHaveLength(1);
    expect(retried.sources.soil.status).toBe("ok");
    expect(retried.sources.rain.fromCache).toBe(true);
  });

  it("does not let a visitor replace a good cached result by asking to refresh it", async () => {
    const cache = new MemoryCache();
    const calls: SourceId[] = [];
    await run({}, { cache, calls }).promise;
    const again = await run({ soil: "fail" }, { cache, calls, request: { ...REQUEST, refresh: ["soil"] } }).promise;
    expect(calls.filter((id) => id === "soil")).toHaveLength(1);
    expect(again.sources.soil.status).toBe("ok");
    expect(again.sources.soil.fromCache).toBe(true);
  });

  it("reuses static sources when only the period changes", async () => {
    const cache = new MemoryCache();
    const calls: SourceId[] = [];
    await run({}, { cache, calls }).promise;
    await run({}, { cache, calls, request: { ...REQUEST, years: 3 } }).promise;
    expect(calls.filter((id) => id === "terrain")).toHaveLength(1);
    expect(calls.filter((id) => id === "rain")).toHaveLength(2);
  });
});

describe("analysisId", () => {
  const period = { start: "2021-01-01", end: "2025-12-31" };

  it("is the same for the same area and period", () => {
    expect(analysisId(AREA, period)).toBe(analysisId(bufferArea(AREA.center, 200), period));
  });

  it("changes with the area and with the period", () => {
    expect(analysisId(AREA, period)).not.toBe(analysisId(bufferArea(AREA.center, 500), period));
    expect(analysisId(AREA, period)).not.toBe(analysisId(AREA, { ...period, start: "2023-01-01" }));
  });
});
