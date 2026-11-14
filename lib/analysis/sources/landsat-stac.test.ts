import { afterEach, describe, expect, it, vi } from "vitest";

import { SourceError } from "../errors";
import {
  buildSearchBody,
  parseSearchPage,
  searchLandsatScenes,
  STAC_SEARCH_URL,
} from "./landsat-stac";
import { fixtureJson, fixtureText, SCENE_ID, TEST_AREA } from "./landsat-test-fixtures";

const jsonResponse = (text: string): Response =>
  new Response(text, { status: 200, headers: { "content-type": "application/geo+json" } });

/** A deep copy of the captured items page, so a test can break one item. */
function itemsPage(): { features: Record<string, Record<string, unknown>>[]; links: unknown[] } {
  return structuredClone(fixtureJson("landsat-stac-items.json")) as {
    features: Record<string, Record<string, unknown>>[];
    links: unknown[];
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseSearchPage", () => {
  it("reads grid, scaling, tier and cloud cover from a real item", () => {
    const { scenes, unreadableItems, next } = parseSearchPage(fixtureJson("landsat-stac-items.json"));
    expect(unreadableItems).toBe(0);
    expect(next).toBeNull();
    expect(scenes).toHaveLength(5);

    const scene = scenes.find((candidate) => candidate.id === SCENE_ID.clear16);
    expect(scene).toMatchObject({
      date: "2025-12-10",
      platform: "landsat-9",
      tier: "T1",
      epsg: 32616,
      cloudCover: 69.75,
      grid: { pixelSize: 30, originY: 1235415 },
      red: { scale: 2.75e-5, offset: -0.2, nodata: 0 },
      nir: { scale: 2.75e-5, offset: -0.2, nodata: 0 },
    });
    expect(scene?.qaBitfields.find((field) => field.name === "cloud")).toMatchObject({ offset: 3, length: 1 });
  });

  it("keeps the scene's own UTM zone and tier", () => {
    const { scenes } = parseSearchPage(fixtureJson("landsat-stac-items.json"));
    // Path 15 row 52 is delivered in zone 17N although the plot lies in zone 16N.
    expect(scenes.find((scene) => scene.id === SCENE_ID.clear17)?.epsg).toBe(32617);
    expect(scenes.find((scene) => scene.id === SCENE_ID.tier2)?.tier).toBe("T2");
  });

  it("returns the next page request when the service offers one", () => {
    const { scenes, next } = parseSearchPage(fixtureJson("landsat-stac-page-1.json"));
    expect(scenes).toHaveLength(2);
    expect(next?.url).toBe("https://planetarycomputer.microsoft.com/api/stac/v1/search?collections=landsat-c2-l2");
    expect(next?.body).toMatchObject({ limit: 2, token: expect.any(String) });
  });

  it("counts an item with broken metadata instead of failing the page", () => {
    const page = itemsPage();
    delete page.features[0].properties["proj:transform"];
    const { scenes, unreadableItems } = parseSearchPage(page);
    expect(scenes).toHaveLength(4);
    expect(unreadableItems).toBe(1);
  });

  it("keeps a scene whose cloud cover is missing or out of range, as unknown", () => {
    const page = itemsPage();
    page.features[0].properties["eo:cloud_cover"] = -1;
    delete page.features[1].properties["eo:cloud_cover"];
    const { scenes, unreadableItems } = parseSearchPage(page);
    expect(unreadableItems).toBe(0);
    expect(scenes[0].cloudCover).toBeNull();
    expect(scenes[1].cloudCover).toBeNull();
    expect(scenes[2].cloudCover).not.toBeNull();
  });

  it("does not accept a rotated grid", () => {
    const page = itemsPage();
    page.features[0].properties["proj:transform"] = [30, 0.1, 707385, 0, -30, 1235415];
    expect(parseSearchPage(page).unreadableItems).toBe(1);
  });

  it("does not accept a platform it was not written for", () => {
    const page = itemsPage();
    page.features[0].properties.platform = "landsat-7";
    expect(parseSearchPage(page).unreadableItems).toBe(1);
  });

  it("accepts an empty result", () => {
    expect(parseSearchPage({ type: "FeatureCollection", features: [], links: [] })).toEqual({
      scenes: [],
      unreadableItems: 0,
      next: null,
    });
  });

  it("throws bad-response when the page is not a feature collection", () => {
    for (const malformed of [null, {}, { features: "none" }, "text"]) {
      expect(() => parseSearchPage(malformed)).toThrowError(SourceError);
    }
  });
});

describe("buildSearchBody", () => {
  it("asks for Landsat 8 and 9 over the polygon and the inclusive period", () => {
    const body = buildSearchBody(TEST_AREA.polygon, { start: "2023-01-01", end: "2025-12-31" });
    expect(body).toMatchObject({
      collections: ["landsat-c2-l2"],
      intersects: TEST_AREA.polygon,
      datetime: "2023-01-01T00:00:00Z/2025-12-31T23:59:59Z",
      query: { platform: { in: ["landsat-8", "landsat-9"] } },
    });
  });
});

describe("searchLandsatScenes", () => {
  it("follows the next link until the last page and sorts newest first", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(fixtureText("landsat-stac-page-1.json")))
      .mockResolvedValueOnce(jsonResponse(fixtureText("landsat-stac-page-2.json")));
    vi.stubGlobal("fetch", fetchMock);

    const period = { start: "2025-12-09", end: "2025-12-10" };
    const result = await searchLandsatScenes(TEST_AREA.polygon, period, new AbortController().signal);

    expect(result.unreadableItems).toBe(0);
    expect(result.scenes.map((scene) => scene.id)).toEqual([
      "LC09_L2SP_015052_20251210_02_T1",
      "LC09_L2SP_015053_20251210_02_T1",
      "LC08_L2SP_016052_20251209_02_T1",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(STAC_SEARCH_URL);

    // The second request repeats the body the service handed back, token included.
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body)) as Record<string, unknown>;
    const page1 = fixtureJson("landsat-stac-page-1.json") as { links: { rel: string; body: unknown }[] };
    expect(secondBody).toEqual(page1.links.find((link) => link.rel === "next")?.body);
  });

  it("throws when the search itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response("nope", { status: 400 })));
    const period = { start: "2025-12-09", end: "2025-12-10" };
    await expect(
      searchLandsatScenes(TEST_AREA.polygon, period, new AbortController().signal),
    ).rejects.toMatchObject({ code: "upstream-error", status: 400 });
  });
});
