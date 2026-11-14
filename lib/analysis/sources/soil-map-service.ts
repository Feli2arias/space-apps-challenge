import { fromArrayBuffer } from "geotiff";
import { SourceError } from "../errors";
import { mapWithConcurrency, requestBytes } from "../http";
import type { LatLon, SoilDepth, SoilProperty } from "../types";

/**
 * The same SoilGrids 250m v2.0 maps, read through ISRIC's map service (an OGC
 * Web Coverage Service at maps.isric.org, one map file per property and one
 * coverage per depth, as described in ISRIC's "SoilGrids access" page).
 *
 * Why it exists: the REST API of SoilGrids is slow and irregular. On
 * 14 Nov 2026 it took 15 to 54 seconds per query and several times did not
 * answer within a minute, while this service answered each coverage in about a
 * second. Checked the same day for Los Chiles (10.95, -84.72): the fifteen
 * values (five properties at three depths) were identical in both services.
 *
 * The service gives the map's whole numbers (the "mapped units": g/kg, pH×10,
 * dg/kg) and no units of its own; the caller converts them with the same
 * factors as the REST answer. A pixel the model does not map (a town centre
 * was checked: La Fortuna, 10.4712, -84.6453) comes back as 0 in every
 * coverage where the REST API answers `null`, so 0 is read as "no value".
 */

const ENDPOINT = "https://maps.isric.org/mapserv";
const CRS_WGS84 = "http://www.opengis.net/def/crs/EPSG/0/4326";

/**
 * Half the side of the window asked for, in degrees. 0.003° is a little more
 * than one 250 m pixel, so the answer holds the pixel under the point (the
 * checked requests came back as a single pixel).
 */
const HALF_WINDOW_DEGREES = 0.0015;
const COORDINATE_DECIMALS = 6;
const REQUEST_TIMEOUT_MS = 12_000;
const CONCURRENT_REQUESTS = 5;
/** What the service writes for a pixel outside the map. */
const UNMAPPED_VALUE = 0;

export interface CoverageRequest {
  readonly property: SoilProperty;
  readonly depth: SoilDepth;
}

export interface CoverageValue extends CoverageRequest {
  /** The map's whole number for the pixel, or `null` when the pixel is not mapped. */
  readonly mapped: number | null;
}

export function buildCoverageUrl(center: LatLon, { property, depth }: CoverageRequest): string {
  const edge = (value: number) => value.toFixed(COORDINATE_DECIMALS);
  const query = [
    `map=/map/${property}.map`,
    "SERVICE=WCS",
    "VERSION=2.0.1",
    "REQUEST=GetCoverage",
    `COVERAGEID=${property}_${depth}_mean`,
    "FORMAT=image/tiff",
    `SUBSET=long(${edge(center.lon - HALF_WINDOW_DEGREES)},${edge(center.lon + HALF_WINDOW_DEGREES)})`,
    `SUBSET=lat(${edge(center.lat - HALF_WINDOW_DEGREES)},${edge(center.lat + HALF_WINDOW_DEGREES)})`,
    `SUBSETTINGCRS=${CRS_WGS84}`,
    `OUTPUTCRS=${CRS_WGS84}`,
  ];
  return `${ENDPOINT}?${query.join("&")}`;
}

/** Reads the pixel in the middle of a coverage answer. `null` when that pixel is not mapped. */
export async function readCoverageValue(bytes: ArrayBuffer): Promise<number | null> {
  try {
    const tiff = await fromArrayBuffer(bytes);
    const image = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
    const [band] = await image.readRasters();
    if (width < 1 || height < 1 || typeof band === "number" || band === undefined) {
      throw new Error("The coverage has no pixels.");
    }
    const value = Number(band[Math.floor(height / 2) * width + Math.floor(width / 2)]);
    if (!Number.isFinite(value) || value < 0) throw new Error("The pixel is not a valid map value.");
    return value === UNMAPPED_VALUE ? null : value;
  } catch (error) {
    throw new SourceError("bad-response", "The SoilGrids map service did not answer with a readable image.", {
      cause: error,
    });
  }
}

/** Asks for every coverage, a few at a time, and returns the map values in the same order. */
export async function fetchCoverageValues(
  center: LatLon,
  requests: readonly CoverageRequest[],
  signal: AbortSignal,
): Promise<readonly CoverageValue[]> {
  return mapWithConcurrency(
    requests,
    CONCURRENT_REQUESTS,
    async (request) => {
      const bytes = await requestBytes(buildCoverageUrl(center, request), {
        timeoutMs: REQUEST_TIMEOUT_MS,
        retries: 1,
        headers: { accept: "image/tiff" },
        signal,
      });
      return { ...request, mapped: await readCoverageValue(bytes) };
    },
    signal,
  );
}
