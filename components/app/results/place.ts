/**
 * Reads the answer of `GET /api/geocode/reverse` and turns it into one line
 * ("Los Chiles, Alajuela, Costa Rica"). The answer is external data: anything
 * that does not have the expected shape is treated as "no place", never thrown.
 */

import type { Locale } from "@/lib/site";

export interface ReversePlace {
  readonly country: string | null;
  readonly countryCode: string | null;
  readonly region: string | null;
  readonly locality: string | null;
  readonly attribution: string;
  readonly fromCache: boolean;
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** The place in the envelope `{ success, data, error }`, or `null` when it is not usable. */
export function parseReversePlace(body: unknown): ReversePlace | null {
  if (!body || typeof body !== "object") return null;
  const envelope = body as { readonly success?: unknown; readonly data?: unknown };
  if (envelope.success !== true || !envelope.data || typeof envelope.data !== "object") return null;
  const data = envelope.data as Record<string, unknown>;
  return {
    country: textOrNull(data.country),
    countryCode: textOrNull(data.countryCode),
    region: textOrNull(data.region),
    locality: textOrNull(data.locality),
    attribution: textOrNull(data.attribution) ?? "",
    fromCache: data.fromCache === true,
  };
}

/** "Los Chiles, Alajuela, Costa Rica"; repeated names are written once. `null` when there is none. */
export function placeLine(place: ReversePlace | null): string | null {
  if (!place) return null;
  const parts = [place.locality, place.region, place.country].filter((part): part is string => part !== null);
  const unique = parts.filter((part, index) => parts.indexOf(part) === index);
  return unique.length > 0 ? unique.join(", ") : null;
}

/** Address of the reverse lookup for a point, or `null` when the point is not a valid coordinate. */
export function reverseUrl(lat: unknown, lon: unknown, locale: Locale): string | null {
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const query = new URLSearchParams({ lat: String(lat), lon: String(lon), lang: locale });
  return `/api/geocode/reverse?${query.toString()}`;
}
