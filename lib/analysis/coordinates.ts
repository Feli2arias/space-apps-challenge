import { COORDINATE_DECIMALS } from "./format";
import type { LatLon } from "./types";

/**
 * Reading coordinates the way people actually write them.
 *
 * The form accepts decimal degrees typed by hand or pasted from a map or a
 * message: with a decimal point or a decimal comma, with or without the degree
 * sign, and with a hemisphere letter instead of a minus sign ("84.72 W", or
 * "84,72 O" in Spanish). Degrees-minutes-seconds are not accepted: guessing
 * that format wrong would silently move the point.
 */

export type CoordinateAxis = "latitude" | "longitude";

/** Why a typed coordinate cannot be used. The form turns each into a sentence. */
export type CoordinateProblem = "empty" | "not-a-number" | "out-of-range";

export type CoordinateResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly problem: CoordinateProblem };

/** Largest absolute value of each axis, in degrees. */
export const COORDINATE_LIMIT: Readonly<Record<CoordinateAxis, number>> = {
  latitude: 90,
  longitude: 180,
};

/** Hemisphere letters, with "O" for the Spanish "oeste". South and west are negative. */
const HEMISPHERES: Readonly<Record<string, { readonly axis: CoordinateAxis; readonly sign: 1 | -1 }>> = {
  N: { axis: "latitude", sign: 1 },
  S: { axis: "latitude", sign: -1 },
  E: { axis: "longitude", sign: 1 },
  W: { axis: "longitude", sign: -1 },
  O: { axis: "longitude", sign: -1 },
};

/** A number with an optional sign and a point or a comma before the decimals. */
const DECIMAL_PATTERN = /^([+-]?)(\d+)(?:[.,](\d+))?$/;
const HEMISPHERE_PATTERN = /^([NSEWO])?(.*?)([NSEWO])?$/i;
/** Typographic minus and dashes that arrive when a value is copied from formatted text. */
const DASHES_PATTERN = /[−‒–—]/g;
const DEGREE_SIGNS_PATTERN = /[°º]/g;

interface ParsedToken {
  readonly value: number;
  /** The axis named by a hemisphere letter, when there was one. */
  readonly axis: CoordinateAxis | null;
}

function normalise(text: string): string {
  return text.replace(DASHES_PATTERN, "-").replace(DEGREE_SIGNS_PATTERN, " ").trim();
}

/** Reads one number with an optional hemisphere letter. `null` when it is not one. */
function parseToken(text: string): ParsedToken | null {
  const letters = HEMISPHERE_PATTERN.exec(text.replace(/\s+/g, ""));
  if (!letters) return null;
  const [, leading, body, trailing] = letters;
  // A letter on both sides ("N10.95N") is not a coordinate anyone meant to write.
  if (leading && trailing) return null;

  const number = DECIMAL_PATTERN.exec(body);
  if (!number) return null;
  const [, sign, whole, decimals] = number;
  const magnitude = Number.parseFloat(`${whole}.${decimals ?? "0"}`);
  const letter = (leading ?? trailing)?.toUpperCase();

  if (!letter) return { value: sign === "-" ? -magnitude : magnitude, axis: null };
  // "-84.72 W" says "west" twice or contradicts itself; either way it is ambiguous.
  if (sign !== "") return null;
  const hemisphere = HEMISPHERES[letter];
  return { value: hemisphere.sign * magnitude, axis: hemisphere.axis };
}

export function isInRange(value: number, axis: CoordinateAxis): boolean {
  return Math.abs(value) <= COORDINATE_LIMIT[axis];
}

/** Reads what was typed in the latitude or the longitude field. */
export function parseCoordinate(text: string, axis: CoordinateAxis): CoordinateResult {
  const cleaned = normalise(text);
  if (cleaned === "") return { ok: false, problem: "empty" };

  const token = parseToken(cleaned);
  // A hemisphere of the other axis ("84.72 W" as a latitude) is a mistake, not a number.
  if (!token || (token.axis !== null && token.axis !== axis)) {
    return { ok: false, problem: "not-a-number" };
  }
  if (!isInRange(token.value, axis)) return { ok: false, problem: "out-of-range" };
  return { ok: true, value: token.value };
}

/**
 * Splits a pasted text into two candidate numbers.
 *
 * A comma can separate the pair ("10.95,-84.72") or the decimals ("10,95"),
 * so a lone comma between digits is only read as a separator when something
 * else in the text shows the decimals are written with points.
 */
function splitPair(cleaned: string): readonly string[] | null {
  if (cleaned.includes(";")) return cleaned.split(";").map((part) => part.trim());

  const parts = cleaned.split(/,\s+|\s+/).filter((part) => part !== "");
  if (parts.length === 2) return parts.map((part) => part.replace(/,$/, ""));
  if (parts.length !== 1) return null;

  const pieces = parts[0].split(",");
  if (pieces.length === 4) return [`${pieces[0]},${pieces[1]}`, `${pieces[2]},${pieces[3]}`];
  if (pieces.length !== 2) return null;
  const isSeparator = parts[0].includes(".") || /^[+-]|[NSEWO]/i.test(pieces[1]) || /[NSEWO]$/i.test(pieces[0]);
  return isSeparator ? pieces : null;
}

function axesOf(first: ParsedToken, second: ParsedToken): readonly [CoordinateAxis, CoordinateAxis] | null {
  const other = (axis: CoordinateAxis): CoordinateAxis => (axis === "latitude" ? "longitude" : "latitude");
  if (first.axis && second.axis) return first.axis === second.axis ? null : [first.axis, second.axis];
  if (first.axis) return [first.axis, other(first.axis)];
  if (second.axis) return [other(second.axis), second.axis];
  // Without letters the order is latitude first, as maps and GPS apps copy it.
  return ["latitude", "longitude"];
}

/**
 * Reads a pair such as "10.95, -84.72" pasted in one go. Returns `null` when
 * the text is not a pair, so the caller can treat it as an ordinary value.
 * Ranges are not checked here: the form shows that problem next to the field.
 */
export function parseCoordinatePair(text: string): LatLon | null {
  const cleaned = normalise(text)
    .replace(/^[([]\s*|\s*[)\]]$/g, "")
    // "10.95 N" and "N 10.95" are one value each: glue the letter to its number.
    .replace(/(\d)\s+([NSEWO])(?![A-Za-z])/gi, "$1$2")
    .replace(/(^|[\s,;])([NSEWO])\s+(?=[\d+-])/gi, "$1$2");

  const parts = splitPair(cleaned);
  if (!parts || parts.length !== 2) return null;
  const first = parseToken(parts[0]);
  const second = parseToken(parts[1]);
  if (!first || !second) return null;

  const axes = axesOf(first, second);
  if (!axes) return null;
  return axes[0] === "latitude"
    ? { lat: first.value, lon: second.value }
    : { lat: second.value, lon: first.value };
}

/**
 * Rounds to the decimals the form shows, so the point that is drawn, the text
 * in the fields and the request sent to the backend are the same numbers.
 */
export function roundCoordinate(value: number): number {
  return Number(value.toFixed(COORDINATE_DECIMALS));
}

export function roundPoint(point: LatLon): LatLon {
  return { lat: roundCoordinate(point.lat), lon: roundCoordinate(point.lon) };
}
