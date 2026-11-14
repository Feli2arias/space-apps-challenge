import { z } from "zod";
import type { Locale } from "@/lib/site";
import { retryAfterSeconds, toApiError } from "./client";
import type { ApiError } from "./types";

/**
 * Browser side of GET /api/geocode: finding a town or a place by name so the
 * map can jump there. A place is where the person starts looking, never the
 * plot itself, so nothing here chooses a point.
 */

export const GEOCODE_ENDPOINT = "/api/geocode";
/** The backend refuses shorter searches; checking first saves the round trip. */
export const MIN_PLACE_QUERY_LENGTH = 2;
export const MAX_PLACE_QUERY_LENGTH = 120;

const placeSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  kind: z.string(),
});

const successSchema = z.looseObject({
  success: z.literal(true),
  data: z.looseObject({
    results: z.array(placeSchema),
    attribution: z.string(),
  }),
});

export type Place = z.infer<typeof placeSchema>;

export type PlaceSearchOutcome =
  | {
      readonly kind: "found";
      readonly places: readonly Place[];
      /** Credit the data provider asks to be shown next to the results. */
      readonly attribution: string;
    }
  | {
      readonly kind: "rejected";
      readonly status: number;
      readonly error: ApiError | null;
      readonly retryAfterSeconds: number | null;
    }
  | { readonly kind: "network" }
  | { readonly kind: "bad-response" }
  | { readonly kind: "aborted" };

export type PlaceSearchFailure = Exclude<PlaceSearchOutcome, { readonly kind: "found" | "aborted" }>;

export interface SearchPlacesOptions {
  readonly signal: AbortSignal;
  /** Replaced in tests. */
  readonly fetchImpl?: typeof fetch;
}

export function isSearchableQuery(query: string): boolean {
  const length = query.trim().length;
  return length >= MIN_PLACE_QUERY_LENGTH && length <= MAX_PLACE_QUERY_LENGTH;
}

/** Searches places by name. Never throws: every ending is a value to show. */
export async function searchPlaces(
  query: string,
  locale: Locale,
  { signal, fetchImpl = fetch }: SearchPlacesOptions,
): Promise<PlaceSearchOutcome> {
  const params = new URLSearchParams({ q: query.trim(), lang: locale });
  try {
    const response = await fetchImpl(`${GEOCODE_ENDPOINT}?${params.toString()}`, {
      headers: { accept: "application/json" },
      signal,
    });
    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        kind: "rejected",
        status: response.status,
        error: toApiError(body),
        retryAfterSeconds: retryAfterSeconds(response.headers),
      };
    }
    const parsed = successSchema.safeParse(body);
    if (!parsed.success) return { kind: "bad-response" };
    return {
      kind: "found",
      places: parsed.data.data.results,
      attribution: parsed.data.data.attribution,
    };
  } catch {
    return signal.aborted ? { kind: "aborted" } : { kind: "network" };
  }
}
