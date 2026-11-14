import { afterEach, describe, expect, it, vi } from "vitest";

import { bufferArea } from "../geometry";
import type { AnalysisArea, DateRange, Metric, SourcePayload, SourceProgress, VegetationData } from "../types";
import { DATA_API_ITEM_URL } from "./landsat-pixels";
import { STAC_SEARCH_URL } from "./landsat-stac";
import { fixtureBytes, fixtureJson, SCENE_ID, TEST_AREA, windowFixtureName } from "./landsat-test-fixtures";
import { vegetationSource } from "./vegetation";

/**
 * The whole source, with `fetch` replaced by a stand-in that answers with the
 * captured responses: the real search result for five scenes and the real
 * pixels of each one over the test area.
 */

interface StacItem {
  id: string;
  properties: Record<string, unknown>;
}

interface ServiceOptions {
  /** Which of the captured items the search returns. Defaults to all five. */
  readonly items?: readonly StacItem[];
  /** Scenes whose pixels the data API refuses with 404. */
  readonly refuse?: readonly string[];
  /** Fixture served for a scene id; defaults to the scene's own window. */
  readonly rasterFor?: (sceneId: string) => string;
  readonly searchStatus?: number;
  /** Called on every pixel request, before answering. */
  readonly onRead?: (sceneId: string) => void;
}

interface Service {
  readonly searchBodies: unknown[];
  readonly readScenes: string[];
}

function capturedItems(): StacItem[] {
  return structuredClone((fixtureJson("landsat-stac-items.json") as { features: StacItem[] }).features);
}

function stubService(options: ServiceOptions = {}): Service {
  const service: Service = { searchBodies: [], readScenes: [] };
  const items = options.items ?? capturedItems();
  const rasterFor = options.rasterFor ?? windowFixtureName;

  const fetchStub = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.startsWith(STAC_SEARCH_URL)) {
      service.searchBodies.push(JSON.parse(String(init?.body)) as unknown);
      if (options.searchStatus) return new Response("error", { status: options.searchStatus });
      return Response.json({ type: "FeatureCollection", features: items, links: [] });
    }
    if (url.startsWith(DATA_API_ITEM_URL)) {
      const sceneId = new URL(url).searchParams.get("item") ?? "";
      service.readScenes.push(sceneId);
      options.onRead?.(sceneId);
      if (options.refuse?.includes(sceneId)) return new Response('{"detail":"No item"}', { status: 404 });
      return new Response(fixtureBytes(rasterFor(sceneId)), { status: 200 });
    }
    throw new Error(`Unexpected request to ${url}`);
  };
  vi.stubGlobal("fetch", vi.fn(fetchStub));
  return service;
}

interface RunResult {
  readonly payload: SourcePayload<VegetationData>;
  readonly progress: readonly SourceProgress[];
}

const YEAR_2025: DateRange = { start: "2025-01-01", end: "2025-12-31" };

async function runSource(
  period: DateRange = YEAR_2025,
  area: AnalysisArea = TEST_AREA,
  signal: AbortSignal = new AbortController().signal,
): Promise<RunResult> {
  const progress: SourceProgress[] = [];
  const payload = await vegetationSource.run({
    area,
    period,
    signal,
    reportProgress: (step) => progress.push(step),
  });
  return { payload, progress };
}

const metricValue = (metrics: readonly Metric[], name: string): number | null | undefined =>
  metrics.find((metric) => metric.id === `vegetation.${name}`)?.value;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("vegetationSource", () => {
  it("declares the product it reads", () => {
    expect(vegetationSource.id).toBe("vegetation");
    expect(vegetationSource.isStatic).toBe(false);
    expect(vegetationSource.product).toMatchObject({
      id: "landsat-c2-l2",
      spatialResolutionMeters: 30,
      temporalResolution: "per-scene",
    });
  });

  it("builds the history from the captured scenes", async () => {
    const service = stubService();
    const { payload } = await runSource();

    expect(payload.status).toBe("ok");
    expect(payload.scope).toBe("parcel");
    expect(payload.period).toEqual(YEAR_2025);
    expect(payload.conversions).toEqual(["reflectance-scale-and-offset"]);

    // One entry per date, oldest first; the Tier 2 scene was never read.
    expect(payload.data.observations.map((entry) => [entry.date, entry.usable, entry.ndviMean])).toEqual([
      ["2025-02-25", false, 0.8173],
      ["2025-03-29", false, null],
      ["2025-12-10", true, 0.8336],
    ]);
    expect(service.readScenes).not.toContain(SCENE_ID.tier2);
    expect(service.readScenes).toHaveLength(4);

    expect(payload.data.monthly).toHaveLength(12);
    expect(payload.data.monthly[11]).toMatchObject({ month: 12, ndviMean: 0.8336, usableObservations: 1 });
    expect(payload.data).toMatchObject({ lowVegetationThreshold: 0.2, minClearFraction: 0.75 });
    // The 43-pixel grid (zone 16N) is the most common among the three dates kept.
    expect(payload.data.pixelsInArea).toBe(43);
  });

  it("reports metrics, quality and limitations that add up", async () => {
    stubService();
    const { payload } = await runSource();
    const value = (name: string) => metricValue(payload.metrics, name);

    expect(value("ndviMean")).toBe(0.8336);
    expect(value("usableObservations")).toBe(1);
    expect(value("monthsWithoutObservation")).toBe(11);
    expect(value("lowVegetationShare")).toBe(0);
    expect(value("scenesFound")).toBe(5);
    expect(value("scenesExamined")).toBe(4);
    expect(value("scenesNotTier1")).toBe(1);
    expect(value("scenesNotRead")).toBe(0);
    expect(value("scenesSameDate")).toBe(1);
    expect(payload.metrics.find((metric) => metric.id === "vegetation.ndviLatest")?.at).toEqual({ date: "2025-12-10" });

    expect(payload.quality).toEqual({
      expected: 3,
      valid: 1,
      coverage: 1 / 3,
      notes: ["months-without-observation"],
    });
    expect(payload.limitations).toEqual([
      "ndvi-is-not-a-diagnosis",
      "low-vegetation-threshold-is-a-convention",
      "cloud-mask-can-miss-clouds",
      "mean-favours-clear-months",
      "tier-2-scenes-not-used",
      "same-date-scenes-counted-once",
    ]);
  });

  it("reports the search and then each scene as it is read", async () => {
    stubService();
    const { progress } = await runSource();
    expect(progress[0]).toEqual({ stage: "searching" });
    expect(progress[1]).toEqual({ stage: "reading-scenes", completed: 0, total: 4 });
    expect(progress.slice(2).map((step) => step.completed)).toEqual([1, 2, 3, 4]);
    expect(progress.at(-1)).toEqual({ stage: "reading-scenes", completed: 4, total: 4 });
  });

  it("reads only the last 36 months of a longer request and says so", async () => {
    const service = stubService();
    const { payload } = await runSource({ start: "2016-01-01", end: "2025-12-31" });
    expect(service.searchBodies[0]).toMatchObject({ datetime: "2023-01-01T00:00:00Z/2025-12-31T23:59:59Z" });
    expect(payload.period).toEqual({ start: "2023-01-01", end: "2025-12-31" });
    expect(payload.limitations).toContain("period-capped");
    expect(payload.data.monthly).toHaveLength(36);
  });

  it("does not mention a cap when the request fits", async () => {
    stubService();
    const { payload } = await runSource({ start: "2023-01-01", end: "2025-12-31" });
    expect(payload.limitations).not.toContain("period-capped");
  });

  it("keeps going when one scene cannot be read, and counts it", async () => {
    stubService({ refuse: [SCENE_ID.clear17] });
    const { payload, progress } = await runSource();
    expect(payload.status).toBe("ok");
    expect(metricValue(payload.metrics, "scenesExamined")).toBe(3);
    expect(metricValue(payload.metrics, "scenesNotRead")).toBe(1);
    expect(metricValue(payload.metrics, "scenesSameDate")).toBe(0);
    expect(payload.quality.notes).toContain("scenes-not-read");
    // The other scene of that pass is used instead.
    expect(payload.data.observations.at(-1)).toMatchObject({ sceneId: SCENE_ID.clear16, ndviMean: 0.8538 });
    expect(progress.at(-1)).toMatchObject({ completed: 4, total: 4 });
  });

  it("keeps going when a scene answers with something that is not a GeoTIFF", async () => {
    // The service's real answer to a point lookup, served in place of the pixels.
    stubService({
      rasterFor: (sceneId) =>
        sceneId === SCENE_ID.cloudy ? `landsat-point-${SCENE_ID.clear16}.json` : windowFixtureName(sceneId),
    });
    const { payload } = await runSource();
    expect(payload.status).toBe("ok");
    expect(metricValue(payload.metrics, "scenesExamined")).toBe(3);
    expect(metricValue(payload.metrics, "scenesNotRead")).toBe(1);
    expect(payload.data.observations.map((entry) => entry.date)).toEqual(["2025-02-25", "2025-12-10"]);
  });

  it("counts an item with unusable metadata as not read", async () => {
    const items = capturedItems();
    delete items.find((item) => item.id === SCENE_ID.cloudy)?.properties["proj:epsg"];
    stubService({ items });
    const { payload } = await runSource();
    expect(metricValue(payload.metrics, "scenesFound")).toBe(5);
    expect(metricValue(payload.metrics, "scenesExamined")).toBe(3);
    expect(metricValue(payload.metrics, "scenesNotTier1")).toBe(1);
    expect(metricValue(payload.metrics, "scenesNotRead")).toBe(1);
    expect(payload.quality.notes).toContain("scenes-not-read");
  });

  it("throws when no scene at all could be read", async () => {
    stubService({ refuse: Object.values(SCENE_ID) });
    await expect(runSource()).rejects.toMatchObject({ name: "SourceError", code: "upstream-error" });
  });

  it("throws when the search fails", async () => {
    stubService({ searchStatus: 400 });
    await expect(runSource()).rejects.toMatchObject({ name: "SourceError", code: "upstream-error" });
  });

  it("answers no-data, with the counts, when no date was clear enough", async () => {
    const cloudyOnly = capturedItems().filter((item) =>
      ([SCENE_ID.cloudy, SCENE_ID.partlyCloudy] as string[]).includes(item.id),
    );
    stubService({ items: cloudyOnly });
    const { payload } = await runSource();

    expect(payload.status).toBe("no-data");
    expect(payload.data.observations).toHaveLength(2);
    expect(payload.data.pixelsInArea).toBe(43);
    expect(metricValue(payload.metrics, "ndviMean")).toBeNull();
    expect(metricValue(payload.metrics, "ndviLatest")).toBeNull();
    expect(metricValue(payload.metrics, "usableObservations")).toBe(0);
    expect(metricValue(payload.metrics, "scenesFound")).toBe(2);
    expect(metricValue(payload.metrics, "scenesExamined")).toBe(2);
    expect(metricValue(payload.metrics, "monthsWithoutObservation")).toBe(12);
    expect(payload.quality).toMatchObject({ expected: 2, valid: 0, coverage: 0 });
  });

  it("answers no-data without reading anything when only Tier 2 scenes exist", async () => {
    const service = stubService({ items: capturedItems().filter((item) => item.id === SCENE_ID.tier2) });
    const { payload } = await runSource();
    expect(payload.status).toBe("no-data");
    expect(service.readScenes).toEqual([]);
    expect(metricValue(payload.metrics, "scenesFound")).toBe(1);
    expect(metricValue(payload.metrics, "scenesNotTier1")).toBe(1);
    expect(payload.limitations).toContain("tier-2-scenes-not-used");
    expect(payload.quality).toMatchObject({ expected: 0, valid: 0, coverage: null });
  });

  it("answers no-data with zero counts when the search finds nothing", async () => {
    stubService({ items: [] });
    const { payload, progress } = await runSource();
    expect(payload.status).toBe("no-data");
    expect(payload.scope).toBe("parcel");
    expect(payload.data).toMatchObject({ observations: [], pixelsInArea: 0 });
    expect(payload.data.monthly).toHaveLength(12);
    expect(metricValue(payload.metrics, "scenesFound")).toBe(0);
    expect(progress.at(-1)).toEqual({ stage: "reading-scenes", completed: 0, total: 0 });
  });

  it("uses the single pixel under the centre for an area of about one pixel", async () => {
    const tiny = bufferArea({ lat: 10.95, lon: -84.72 }, 20);
    stubService({
      items: capturedItems().filter((item) => item.id === SCENE_ID.clear16),
      rasterFor: (sceneId) => `landsat-window-pixel-${sceneId}.tif`,
    });
    const { payload } = await runSource(YEAR_2025, tiny);
    expect(payload.scope).toBe("pixel");
    expect(payload.data.pixelsInArea).toBe(1);
    expect(payload.limitations).toContain("single-pixel");
    // Red 8582 and near infrared 22783, the values of the service's point lookup.
    expect(payload.data.observations).toEqual([
      expect.objectContaining({ clearPixels: 1, totalPixels: 1, usable: true, ndviMean: 0.8443, ndviMin: 0.8443 }),
    ]);
  });

  it("stops when the analysis is cancelled", async () => {
    stubService();
    const controller = new AbortController();
    controller.abort();
    await expect(runSource(YEAR_2025, TEST_AREA, controller.signal)).rejects.toMatchObject({ code: "aborted" });
  });

  it("stops starting scenes when the time allowed runs out, leaving out the oldest", async () => {
    // Control-flow test: ten copies of one captured item on ten different days,
    // all answered with that item's real pixels. Eight scenes are read at once;
    // the clock jumps past the budget as the eighth read starts, so the two
    // scenes still waiting are never started.
    const template = capturedItems().find((item) => item.id === SCENE_ID.clear16);
    if (!template) throw new Error("Missing fixture item.");
    const items = Array.from({ length: 10 }, (_, index) => ({
      ...template,
      id: `COPY_${index}`,
      properties: { ...template.properties, datetime: `2025-12-${String(index + 10).padStart(2, "0")}T15:54:43Z` },
    }));

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
    let reads = 0;
    stubService({
      items,
      rasterFor: () => windowFixtureName(SCENE_ID.clear16),
      onRead: () => {
        reads += 1;
        if (reads === 8) vi.setSystemTime(new Date("2026-11-14T12:02:00Z"));
      },
    });

    const { payload } = await runSource();
    expect(metricValue(payload.metrics, "scenesExamined")).toBe(8);
    expect(metricValue(payload.metrics, "scenesNotRead")).toBe(2);
    expect(payload.quality.notes).toContain("time-budget-reached");
    expect(payload.data.observations.map((entry) => entry.date)).toEqual(
      Array.from({ length: 8 }, (_, index) => `2025-12-${index + 12}`),
    );
  });
});
