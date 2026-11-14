import { z } from "zod";
import { SourceError } from "@/lib/analysis/errors";
import { requestJson } from "@/lib/analysis/http";

/**
 * Place search through OpenStreetMap's Nominatim service.
 *
 * Its usage policy (https://operations.osmfoundation.org/policies/nominatim/)
 * asks for: at most one request per second in total, an identifying
 * User-Agent, visible attribution, caching, and the ability to switch to
 * another server without a new release. Each of those is handled here or in
 * the route that calls this module.
 */

const DEFAULT_BASE_URL = "https://nominatim.openstreetmap.org";
/** The policy's absolute maximum is one request per second; stay just under it. */
const MIN_INTERVAL_MS = 1_100;
const MAX_RESULTS = 5;
const TIMEOUT_MS = 10_000;

export const GEOCODER_ATTRIBUTION = "© OpenStreetMap contributors (ODbL)";

export interface PlaceResult {
  readonly name: string;
  /** Full description, e.g. "Los Chiles, Alajuela, Costa Rica". */
  readonly displayName: string;
  readonly lat: number;
  readonly lon: number;
  /** What kind of place it is, as OpenStreetMap labels it (town, county, village…). */
  readonly kind: string;
}

const responseSchema = z.array(
  z.object({
    name: z.string().optional(),
    display_name: z.string(),
    lat: z.string(),
    lon: z.string(),
    addresstype: z.string().optional(),
    type: z.string().optional(),
  }),
);

/** Other servers that speak the same API can be used by setting GEOCODER_URL. */
function baseUrl(): string {
  return process.env.GEOCODER_URL?.replace(/\/+$/, "") || DEFAULT_BASE_URL;
}

/** Searches allowed to wait their turn; beyond this the server answers "busy" at once. */
const MAX_WAITING = 20;

let queue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;
let waiting = 0;

function cancelled(): SourceError {
  return new SourceError("aborted", "The search was cancelled.");
}

/**
 * Runs one request at a time, spaced out, however many visitors are searching.
 * The line is bounded, and a search whose visitor has left gives up its turn
 * without using a slot, so abandoned searches cannot hold everyone else back.
 */
function throttled<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (waiting >= MAX_WAITING) {
    return Promise.reject(new SourceError("rate-limited", "Too many place searches are waiting."));
  }
  waiting += 1;

  const run = queue.then(async () => {
    try {
      if (signal?.aborted) throw cancelled();
      const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      if (signal?.aborted) throw cancelled();
      lastRequestAt = Date.now();
      return await task();
    } finally {
      waiting -= 1;
    }
  });
  // Keep the queue alive even when a request fails.
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function toPlaceResults(raw: unknown): PlaceResult[] {
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new SourceError("bad-response", "The place search answered in an unexpected format.");
  }
  return parsed.data
    .map((item) => ({
      name: item.name || item.display_name.split(",")[0].trim(),
      displayName: item.display_name,
      lat: Number.parseFloat(item.lat),
      lon: Number.parseFloat(item.lon),
      kind: item.addresstype ?? item.type ?? "place",
    }))
    .filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lon));
}

export async function searchPlaces(
  query: string,
  language: string,
  signal?: AbortSignal,
): Promise<PlaceResult[]> {
  const url = new URL(`${baseUrl()}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", String(MAX_RESULTS));
  url.searchParams.set("accept-language", language);

  const raw = await throttled(
    () => requestJson(url.toString(), { timeoutMs: TIMEOUT_MS, retries: 0, signal }),
    signal,
  );
  return toPlaceResults(raw);
}

/** Where a point is, in words. Every field is `null` when the place is unknown (open sea). */
export interface PlaceName {
  readonly country: string | null;
  /** Two-letter country code in upper case, e.g. "CR". */
  readonly countryCode: string | null;
  /** State, province or department. */
  readonly region: string | null;
  /** The town, municipality or county the point falls in. */
  readonly locality: string | null;
}

/**
 * Level of detail asked for: 10 is "city or town" in Nominatim's zoom scale
 * (https://nominatim.org/release-docs/latest/api/Reverse/). Nothing finer is
 * needed, and a coarser answer says less about where exactly a plot is.
 */
const REVERSE_ZOOM = 10;

const UNKNOWN_PLACE: PlaceName = { country: null, countryCode: null, region: null, locality: null };

const reverseSchema = z.union([
  z.object({
    address: z.object({
      country: z.string().optional(),
      country_code: z.string().optional(),
      state: z.string().optional(),
      province: z.string().optional(),
      region: z.string().optional(),
      city: z.string().optional(),
      town: z.string().optional(),
      village: z.string().optional(),
      municipality: z.string().optional(),
      county: z.string().optional(),
    }),
  }),
  // What the service answers for a point with no known place, such as open sea.
  z.object({ error: z.string() }),
]);

export function toPlaceName(raw: unknown): PlaceName {
  const parsed = reverseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new SourceError("bad-response", "The place lookup answered in an unexpected format.");
  }
  if ("error" in parsed.data) return UNKNOWN_PLACE;

  const { address } = parsed.data;
  return {
    country: address.country ?? null,
    countryCode: address.country_code ? address.country_code.toUpperCase() : null,
    region: address.state ?? address.province ?? address.region ?? null,
    locality:
      address.city ?? address.town ?? address.village ?? address.municipality ?? address.county ?? null,
  };
}

/** Names the place a point falls in: town, region and country. */
export async function lookupPlace(
  latitude: number,
  longitude: number,
  language: string,
  signal?: AbortSignal,
): Promise<PlaceName> {
  const url = new URL(`${baseUrl()}/reverse`);
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("zoom", String(REVERSE_ZOOM));
  url.searchParams.set("accept-language", language);

  const raw = await throttled(
    () => requestJson(url.toString(), { timeoutMs: TIMEOUT_MS, retries: 0, signal }),
    signal,
  );
  return toPlaceName(raw);
}
