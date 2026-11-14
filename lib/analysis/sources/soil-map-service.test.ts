import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bufferArea } from "../geometry";
import { parseSoilResponse, SOIL_DEPTHS, SOIL_PROPERTIES, soilSource, toRestShape } from "./soil";
import {
  buildCoverageUrl,
  fetchCoverageValues,
  readCoverageValue,
  type CoverageValue,
} from "./soil-map-service";

const LOS_CHILES = { lat: 10.95, lon: -84.72 };
const PERIOD = { start: "2021-01-01", end: "2025-12-31" };

/** Real answers of the map service, saved on 14 Nov 2026. */
function fixture(name: string): ArrayBuffer {
  const file = readFileSync(path.join(__dirname, "__fixtures__", name));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
}

const mappedPixel = () => fixture("soil-map-clay-0-5cm-los-chiles.tif");
const unmappedPixel = () => fixture("soil-map-clay-0-5cm-unmapped-la-fortuna.tif");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildCoverageUrl", () => {
  it("asks for one property at one depth in a small window around the point", () => {
    const url = buildCoverageUrl(LOS_CHILES, { property: "phh2o", depth: "5-15cm" });
    expect(url).toContain("https://maps.isric.org/mapserv?map=/map/phh2o.map");
    expect(url).toContain("REQUEST=GetCoverage");
    expect(url).toContain("COVERAGEID=phh2o_5-15cm_mean");
    expect(url).toContain("SUBSET=long(-84.721500,-84.718500)");
    expect(url).toContain("SUBSET=lat(10.948500,10.951500)");
  });
});

describe("readCoverageValue", () => {
  it("reads the map's number for the pixel under the point", async () => {
    // The REST API gave the same 396 (39.6 % clay) for this pixel.
    await expect(readCoverageValue(mappedPixel())).resolves.toBe(396);
  });

  it("reads a pixel outside the map as missing, not as zero", async () => {
    await expect(readCoverageValue(unmappedPixel())).resolves.toBeNull();
  });

  it("rejects an answer that is not an image", async () => {
    const xml = new TextEncoder().encode("<ows:ExceptionReport/>").buffer as ArrayBuffer;
    await expect(readCoverageValue(xml)).rejects.toMatchObject({ code: "bad-response" });
  });
});

describe("toRestShape", () => {
  it("passes through the same validation and conversion as the REST answer", () => {
    const values: CoverageValue[] = SOIL_PROPERTIES.flatMap((property) =>
      SOIL_DEPTHS.map((depth) => ({ property, depth, mapped: property === "clay" ? 396 : null })),
    );
    const layers = parseSoilResponse(toRestShape(values));
    expect(layers).toHaveLength(15);
    expect(layers.find((layer) => layer.property === "clay" && layer.depth === "0-5cm")?.mean).toBe(39.6);
    expect(layers.find((layer) => layer.property === "sand" && layer.depth === "0-5cm")?.mean).toBeNull();
  });
});

describe("the map service as the first way in", () => {
  const imageResponse = (bytes: ArrayBuffer) =>
    new Response(bytes, { status: 200, headers: { "content-type": "image/tiff" } });

  it("asks for the fifteen coverages and keeps their order", async () => {
    const fetchMock = vi.fn(async () => imageResponse(mappedPixel()));
    vi.stubGlobal("fetch", fetchMock);
    const requests = SOIL_PROPERTIES.flatMap((property) => SOIL_DEPTHS.map((depth) => ({ property, depth })));

    const values = await fetchCoverageValues(LOS_CHILES, requests, new AbortController().signal);

    expect(fetchMock).toHaveBeenCalledTimes(15);
    expect(values.map((value) => `${value.property} ${value.depth}`)).toEqual(
      requests.map((request) => `${request.property} ${request.depth}`),
    );
    expect(values.every((value) => value.mapped === 396)).toBe(true);
  });

  it("gives the soil without calling the REST API when the map service answers", async () => {
    const fetchMock = vi.fn(async () => imageResponse(mappedPixel()));
    vi.stubGlobal("fetch", fetchMock);

    const payload = await soilSource.run({
      area: bufferArea(LOS_CHILES, 200),
      period: PERIOD,
      signal: new AbortController().signal,
      reportProgress: () => undefined,
    });

    expect(payload.status).toBe("ok");
    expect(payload.metrics.find((metric) => metric.id === "soil.clay")?.value).toBe(39.6);
    const urls = fetchMock.mock.calls.map((call) => String((call as unknown[])[0]));
    expect(urls.every((url) => url.includes("maps.isric.org"))).toBe(true);
  });

  it("answers no-data for a pixel the map does not cover", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => imageResponse(unmappedPixel())));

    const payload = await soilSource.run({
      area: bufferArea({ lat: 10.4712, lon: -84.6453 }, 200),
      period: PERIOD,
      signal: new AbortController().signal,
      reportProgress: () => undefined,
    });

    expect(payload.status).toBe("no-data");
    expect(payload.metrics.every((metric) => metric.value === null)).toBe(true);
  });
});
