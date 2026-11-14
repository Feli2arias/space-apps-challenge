import { z } from "zod";

import { SourceError } from "../errors";
import { requestJson } from "../http";
import type { DateRange, LandsatPlatform, PolygonGeometry } from "../types";

/**
 * Finds the Landsat 8/9 scenes that cover an area, through the STAC API of the
 * Microsoft Planetary Computer (no key needed).
 *
 * Everything the reading step needs comes from each scene's own metadata: the
 * pixel grid, the scale and offset of the reflectance bands and the meaning of
 * the quality bits. Nothing about the product is assumed from memory.
 */

export const LANDSAT_COLLECTION = "landsat-c2-l2";
export const STAC_SEARCH_URL = "https://planetarycomputer.microsoft.com/api/stac/v1/search";

/** Scenes per page. A real search with 400 answered in one page (1 MB, 1.7 s); 250 keeps pages lighter. */
const PAGE_LIMIT = 250;
/** Stops a search whose "next" links never end. 20 pages is 5,000 scenes, far above any real case. */
const MAX_PAGES = 20;
const MIN_CLOUD_COVER_PERCENT = 0;
const MAX_CLOUD_COVER_PERCENT = 100;
/** A page of the search answers in 1.3 to 2.4 s (measured); 20 s and one retry bound the wait at about 40 s. */
const SEARCH_TIMEOUT_MS = 20_000;
const SEARCH_RETRIES = 1;
/** Only the instruments with the OLI band layout this code reads (red = B4, near infrared = B5). */
const PLATFORMS = ["landsat-8", "landsat-9"] as const satisfies readonly LandsatPlatform[];

/**
 * Only the fields that are used. A full item weighs about 23 kB; with this
 * list it weighs about 4 kB, so three years of scenes stay near 1.5 MB.
 */
const FIELDS = {
  include: [
    "id",
    "properties.datetime",
    "properties.platform",
    "properties.proj:epsg",
    "properties.proj:transform",
    "properties.proj:shape",
    "properties.eo:cloud_cover",
    "properties.landsat:collection_category",
    "assets.red.raster:bands",
    "assets.nir08.raster:bands",
    "assets.qa_pixel.classification:bitfields",
  ],
  exclude: ["links", "geometry", "bbox", "stac_extensions", "stac_version", "collection"],
} as const;

/** How stored integers become surface reflectance: reflectance = stored × scale + offset. */
export interface BandScaling {
  readonly scale: number;
  readonly offset: number;
  /** Stored value that means "no data". */
  readonly nodata: number;
}

/** One entry of the scene's description of the quality band. */
export interface QaBitfield {
  readonly name: string;
  /** Position of the first bit, counting from the least significant one. */
  readonly offset: number;
  /** How many bits the field uses. */
  readonly length: number;
}

/** The scene's raster: north-up square pixels in a projected coordinate system. */
export interface SceneGrid {
  /** X of the left edge of the first column, in the scene's coordinate system. */
  readonly originX: number;
  /** Y of the top edge of the first row. */
  readonly originY: number;
  /** Side of a pixel in metres. */
  readonly pixelSize: number;
  readonly columns: number;
  readonly rows: number;
}

export interface LandsatScene {
  readonly id: string;
  /** Acquisition date in UTC, YYYY-MM-DD. */
  readonly date: string;
  readonly platform: LandsatPlatform;
  /** Collection tier as published ("T1", "T2"). `null` when the scene does not state it. */
  readonly tier: string | null;
  /** EPSG code of the scene's coordinate system. */
  readonly epsg: number;
  readonly grid: SceneGrid;
  /** Cloud cover of the whole scene, in percent. */
  readonly cloudCover: number | null;
  readonly red: BandScaling;
  readonly nir: BandScaling;
  readonly qaBitfields: readonly QaBitfield[];
}

export interface LandsatSearchResult {
  /** Newest first. */
  readonly scenes: readonly LandsatScene[];
  /** Items the service returned whose metadata could not be used. */
  readonly unreadableItems: number;
}

const bandSchema = z.object({ scale: z.number(), offset: z.number(), nodata: z.number() });

const itemSchema = z.object({
  id: z.string().min(1),
  properties: z.object({
    datetime: z.iso.datetime({ offset: true }),
    platform: z.enum(PLATFORMS),
    "proj:epsg": z.number().int(),
    "proj:transform": z.array(z.number()).min(6),
    "proj:shape": z.tuple([z.number().int().positive(), z.number().int().positive()]),
    "eo:cloud_cover": z.number().nullish(),
    "landsat:collection_category": z.string().nullish(),
  }),
  assets: z.object({
    red: z.object({ "raster:bands": z.array(bandSchema).min(1) }),
    nir08: z.object({ "raster:bands": z.array(bandSchema).min(1) }),
    qa_pixel: z.object({
      "classification:bitfields": z
        .array(
          z.object({
            name: z.string(),
            offset: z.number().int().min(0),
            length: z.number().int().min(1),
          }),
        )
        .min(1),
    }),
  }),
});

const pageSchema = z.object({
  features: z.array(z.unknown()),
  links: z
    .array(
      z.object({
        rel: z.string(),
        href: z.string().optional(),
        method: z.string().optional(),
        body: z.unknown().optional(),
      }),
    )
    .default([]),
});

interface NextPage {
  readonly url: string;
  readonly body: unknown;
}

export interface LandsatSearchPage {
  readonly scenes: readonly LandsatScene[];
  readonly unreadableItems: number;
  readonly next: NextPage | null;
}

/**
 * Reads the affine transform [a, b, c, d, e, f] (x = a·col + b·row + c,
 * y = d·col + e·row + f). Only north-up grids with square pixels are accepted,
 * which is how every Landsat Collection 2 scene is delivered.
 */
function toGrid(transform: readonly number[], shape: readonly [number, number]): SceneGrid | null {
  const [pixelWidth, rowRotation, originX, columnRotation, pixelHeight, originY] = transform;
  const isNorthUp = rowRotation === 0 && columnRotation === 0;
  const isSquare = pixelWidth > 0 && pixelHeight === -pixelWidth;
  if (!isNorthUp || !isSquare) return null;
  return { originX, originY, pixelSize: pixelWidth, rows: shape[0], columns: shape[1] };
}

/**
 * Cloud cover is shown for information only, so a value outside 0–100 must not
 * cost the scene: it is reported as unknown. (A search on 2026-11-14 found no
 * Landsat 8/9 item with a negative value, but nothing guarantees it.)
 */
function toCloudCover(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return value >= MIN_CLOUD_COVER_PERCENT && value <= MAX_CLOUD_COVER_PERCENT ? value : null;
}

function toScene(item: unknown): LandsatScene | null {
  const parsed = itemSchema.safeParse(item);
  if (!parsed.success) return null;
  const { id, properties, assets } = parsed.data;
  const grid = toGrid(properties["proj:transform"], properties["proj:shape"]);
  if (!grid) return null;
  return {
    id,
    // The first ten characters of an ISO 8601 instant are its calendar date.
    date: new Date(properties.datetime).toISOString().slice(0, 10),
    platform: properties.platform,
    tier: properties["landsat:collection_category"] ?? null,
    epsg: properties["proj:epsg"],
    grid,
    cloudCover: toCloudCover(properties["eo:cloud_cover"]),
    red: assets.red["raster:bands"][0],
    nir: assets.nir08["raster:bands"][0],
    qaBitfields: assets.qa_pixel["classification:bitfields"],
  };
}

/** Validates one page of search results. Throws when the page itself is malformed. */
export function parseSearchPage(json: unknown): LandsatSearchPage {
  const page = pageSchema.safeParse(json);
  if (!page.success) {
    throw new SourceError("bad-response", "The Landsat scene search answered in an unexpected shape.");
  }
  const scenes = page.data.features.map(toScene);
  const valid = scenes.filter((scene): scene is LandsatScene => scene !== null);
  const nextLink = page.data.links.find((link) => link.rel === "next");
  const next =
    nextLink?.href && nextLink.method === "POST" && nextLink.body !== undefined
      ? { url: nextLink.href, body: nextLink.body }
      : null;
  return { scenes: valid, unreadableItems: scenes.length - valid.length, next };
}

/** The body of the first search request, exactly as the STAC API expects it. */
export function buildSearchBody(polygon: PolygonGeometry, period: DateRange): Record<string, unknown> {
  return {
    collections: [LANDSAT_COLLECTION],
    intersects: polygon,
    datetime: `${period.start}T00:00:00Z/${period.end}T23:59:59Z`,
    limit: PAGE_LIMIT,
    query: { platform: { in: PLATFORMS } },
    sortby: [{ field: "properties.datetime", direction: "desc" }],
    fields: FIELDS,
  };
}

/** Every Landsat 8/9 scene that touches the polygon in the period, newest first. */
export async function searchLandsatScenes(
  polygon: PolygonGeometry,
  period: DateRange,
  signal: AbortSignal,
): Promise<LandsatSearchResult> {
  let next: NextPage | null = { url: STAC_SEARCH_URL, body: buildSearchBody(polygon, period) };
  let scenes: readonly LandsatScene[] = [];
  let unreadableItems = 0;

  for (let pageNumber = 0; next !== null; pageNumber += 1) {
    if (pageNumber >= MAX_PAGES) {
      throw new SourceError("bad-response", `The Landsat scene search did not end after ${MAX_PAGES} pages.`);
    }
    const json = await requestJson(next.url, {
      method: "POST",
      body: next.body,
      signal,
      timeoutMs: SEARCH_TIMEOUT_MS,
      retries: SEARCH_RETRIES,
    });
    const page = parseSearchPage(json);
    scenes = [...scenes, ...page.scenes];
    unreadableItems += page.unreadableItems;
    next = page.next;
  }

  const newestFirst = [...scenes].sort(
    (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
  );
  return { scenes: newestFirst, unreadableItems };
}
