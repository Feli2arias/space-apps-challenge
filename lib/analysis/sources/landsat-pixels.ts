import { fromArrayBuffer } from "geotiff";

import { SourceError } from "../errors";
import { requestBytes } from "../http";
import { LANDSAT_COLLECTION } from "./landsat-stac";
import type { LandsatScene, SceneGrid } from "./landsat-stac";
import type { PixelWindow } from "./landsat-window";

/**
 * Reads a small block of pixels of one Landsat scene through the data API of
 * the Microsoft Planetary Computer (a TiTiler service; OpenAPI at
 * https://planetarycomputer.microsoft.com/api/data/v1/openapi.json).
 *
 * Why this path and not the cloud-optimised GeoTIFFs directly: measured on the
 * same scenes, the data API needs 1 request and about 0.9 kB per scene
 * (median 0.5 s), while reading the three files with signed URLs needed 27
 * requests and about 250 kB per scene (2 to 3.5 s). Both returned identical
 * pixel values.
 *
 * The block is requested in the scene's own coordinate system, on pixel
 * boundaries, with one output pixel per stored pixel. That way the service
 * hands back the stored values as they are; nothing is resampled, which
 * matters because the quality band holds bit flags that cannot be averaged.
 */

export const DATA_API_ITEM_URL = "https://planetarycomputer.microsoft.com/api/data/v1/item";

/** Asset names of the collection, in the order the bands are requested and returned. */
const ASSETS = ["red", "nir08", "qa_pixel"] as const;

/**
 * One scene answers in about 0.5 s (slowest measured: 1.6 s, and 2.3 s for the
 * largest window allowed). After 10 s the service is stuck, and waiting longer
 * would eat the time of the scenes that do answer.
 */
const SCENE_TIMEOUT_MS = 10_000;
/** One extra attempt: a failed scene is reported, it does not stop the analysis. */
const SCENE_RETRIES = 1;
/** Tolerance, in metres, when checking that the answer sits on the requested pixel boundaries. */
const ALIGNMENT_TOLERANCE_METERS = 1e-6;

/** Stored values of a window, row by row from the top-left pixel. */
export interface SceneWindowPixels {
  readonly width: number;
  readonly height: number;
  /** Stored integers of the red band (not yet scaled to reflectance). */
  readonly red: ArrayLike<number>;
  /** Stored integers of the near-infrared band. */
  readonly nir: ArrayLike<number>;
  /** Values of the QA_PIXEL band (bit flags). */
  readonly qa: ArrayLike<number>;
}

interface WindowBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Outer edges of the window in the scene's coordinate system. */
export function windowBounds(grid: SceneGrid, window: PixelWindow): WindowBounds {
  return {
    minX: grid.originX + window.column * grid.pixelSize,
    maxX: grid.originX + (window.column + window.width) * grid.pixelSize,
    maxY: grid.originY - window.row * grid.pixelSize,
    minY: grid.originY - (window.row + window.height) * grid.pixelSize,
  };
}

type SceneReference = Pick<LandsatScene, "id" | "epsg" | "grid">;

/** URL of `GET /item/bbox/{minx},{miny},{maxx},{maxy}/{width}x{height}.tif` for a window. */
export function buildWindowUrl(scene: SceneReference, window: PixelWindow): string {
  const { minX, minY, maxX, maxY } = windowBounds(scene.grid, window);
  const crs = `epsg:${scene.epsg}`;
  const query = new URLSearchParams([
    ["collection", LANDSAT_COLLECTION],
    ["item", scene.id],
    ...ASSETS.map((asset): [string, string] => ["assets", asset]),
    // Each asset is a one-band file; this returns them as bands 1, 2 and 3.
    ["asset_as_band", "true"],
    // Bounds given and answered in the scene's own system: no reprojection.
    ["coord_crs", crs],
    ["dst_crs", crs],
    ["resampling", "nearest"],
    // The validity band adds nothing here: fill pixels are flagged in QA_PIXEL.
    ["return_mask", "false"],
  ]);
  const size = `${window.width}x${window.height}`;
  return `${DATA_API_ITEM_URL}/bbox/${minX},${minY},${maxX},${maxY}/${size}.tif?${query.toString()}`;
}

function badResponse(sceneId: string, problem: string, cause?: unknown): SourceError {
  return new SourceError("bad-response", `Scene ${sceneId}: ${problem}.`, { cause });
}

/** Parses the GeoTIFF answered by the data API and checks it is the window that was asked for. */
export async function decodeWindowTiff(
  bytes: ArrayBuffer,
  scene: SceneReference,
  window: PixelWindow,
): Promise<SceneWindowPixels> {
  try {
    const tiff = await fromArrayBuffer(bytes);
    const image = await tiff.getImage(0);
    const bounds = windowBounds(scene.grid, window);
    const [originX, originY] = image.getOrigin();
    const [resolutionX] = image.getResolution();
    const isRequestedWindow =
      image.getWidth() === window.width &&
      image.getHeight() === window.height &&
      image.getSamplesPerPixel() === ASSETS.length &&
      Math.abs(originX - bounds.minX) <= ALIGNMENT_TOLERANCE_METERS &&
      Math.abs(originY - bounds.maxY) <= ALIGNMENT_TOLERANCE_METERS &&
      Math.abs(resolutionX - scene.grid.pixelSize) <= ALIGNMENT_TOLERANCE_METERS;
    if (!isRequestedWindow) throw badResponse(scene.id, "the answer is not the window that was requested");

    const rasters = await image.readRasters();
    if (!Array.isArray(rasters) || rasters.length !== ASSETS.length) {
      throw badResponse(scene.id, "the answer does not hold the three bands requested");
    }
    const [red, nir, qa] = rasters;
    return { width: window.width, height: window.height, red, nir, qa };
  } catch (error) {
    if (error instanceof SourceError) throw error;
    throw badResponse(scene.id, "the answer is not a readable GeoTIFF", error);
  }
}

/** Fetches and decodes the pixels of one window of one scene. */
export async function readSceneWindow(
  scene: SceneReference,
  window: PixelWindow,
  signal: AbortSignal,
): Promise<SceneWindowPixels> {
  const bytes = await requestBytes(buildWindowUrl(scene, window), {
    signal,
    timeoutMs: SCENE_TIMEOUT_MS,
    retries: SCENE_RETRIES,
  });
  return decodeWindowTiff(bytes, scene, window);
}
