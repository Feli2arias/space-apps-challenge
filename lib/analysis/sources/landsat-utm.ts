import type { Position } from "../types";

/**
 * Longitude/latitude to UTM coordinates.
 *
 * Landsat scenes are stored on a 30 m grid in a UTM zone chosen for the whole
 * scene, which is not always the zone the plot would naturally fall in (near
 * Los Chiles, path 15 row 52 is delivered in zone 17N while the plot sits in
 * zone 16N). So the zone is always taken from the scene, never from the point.
 *
 * The projection is the Krüger series for the transverse Mercator (Karney,
 * "Transverse Mercator with an accuracy of a few nanometers", 2011), truncated
 * at the third order. The tests compare it with coordinates returned by the
 * Planetary Computer (PROJ) for the same corners: they agree to under 1 mm,
 * also 6.7 degrees away from the central meridian.
 */

/** WGS 84 ellipsoid (EPSG:7030): semi-major axis in metres and inverse flattening. */
const WGS84_SEMI_MAJOR_AXIS_METERS = 6_378_137;
const WGS84_INVERSE_FLATTENING = 298.257223563;

/** UTM definition (EPSG:16001 to 16160): scale on the central meridian and false origins. */
const UTM_SCALE_FACTOR = 0.9996;
const UTM_FALSE_EASTING_METERS = 500_000;
const UTM_SOUTH_FALSE_NORTHING_METERS = 10_000_000;
const UTM_ZONE_WIDTH_DEGREES = 6;
/** Central meridian of zone z is 6z − 183 degrees. */
const UTM_FIRST_CENTRAL_MERIDIAN_OFFSET_DEGREES = 183;
const UTM_ZONE_COUNT = 60;

/** EPSG codes of "WGS 84 / UTM zone N": 32601–32660 north, 32701–32760 south. */
const EPSG_UTM_NORTH_BASE = 32_600;
const EPSG_UTM_SOUTH_BASE = 32_700;

export interface UtmZone {
  /** 1 to 60. */
  readonly zone: number;
  readonly hemisphere: "north" | "south";
}

export interface UtmPoint {
  /** Metres east, including the 500 km false easting. */
  readonly x: number;
  /** Metres north of the equator (north zones) or of the 10,000 km false origin (south zones). */
  readonly y: number;
}

/** The UTM zone behind an EPSG code, or `null` when the code is not WGS 84 / UTM. */
export function utmZoneFromEpsg(epsg: number): UtmZone | null {
  if (!Number.isInteger(epsg)) return null;
  const north = epsg - EPSG_UTM_NORTH_BASE;
  if (north >= 1 && north <= UTM_ZONE_COUNT) return { zone: north, hemisphere: "north" };
  const south = epsg - EPSG_UTM_SOUTH_BASE;
  if (south >= 1 && south <= UTM_ZONE_COUNT) return { zone: south, hemisphere: "south" };
  return null;
}

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Third flattening and the Krüger coefficients depend only on the ellipsoid. */
const FLATTENING = 1 / WGS84_INVERSE_FLATTENING;
const N = FLATTENING / (2 - FLATTENING);
const RECTIFYING_RADIUS_METERS =
  (WGS84_SEMI_MAJOR_AXIS_METERS / (1 + N)) * (1 + N ** 2 / 4 + N ** 4 / 64);
const KRUGER_ALPHA: readonly number[] = [
  N / 2 - (2 * N ** 2) / 3 + (5 * N ** 3) / 16,
  (13 * N ** 2) / 48 - (3 * N ** 3) / 5,
  (61 * N ** 3) / 240,
];
const CONFORMAL_FACTOR = (2 * Math.sqrt(N)) / (1 + N);

/** Projects a longitude/latitude position (WGS 84) into the given UTM zone. */
export function toUtm(position: Position, zone: UtmZone): UtmPoint {
  const centralMeridian = toRadians(
    zone.zone * UTM_ZONE_WIDTH_DEGREES - UTM_FIRST_CENTRAL_MERIDIAN_OFFSET_DEGREES,
  );
  const deltaLongitude = toRadians(position[0]) - centralMeridian;
  const sinLatitude = Math.sin(toRadians(position[1]));

  // Tangent of the conformal latitude.
  const tau = Math.sinh(
    Math.atanh(sinLatitude) - CONFORMAL_FACTOR * Math.atanh(CONFORMAL_FACTOR * sinLatitude),
  );
  const xiPrime = Math.atan2(tau, Math.cos(deltaLongitude));
  const etaPrime = Math.atanh(Math.sin(deltaLongitude) / Math.sqrt(1 + tau * tau));

  let xi = xiPrime;
  let eta = etaPrime;
  KRUGER_ALPHA.forEach((alpha, index) => {
    const order = 2 * (index + 1);
    xi += alpha * Math.sin(order * xiPrime) * Math.cosh(order * etaPrime);
    eta += alpha * Math.cos(order * xiPrime) * Math.sinh(order * etaPrime);
  });

  const falseNorthing = zone.hemisphere === "south" ? UTM_SOUTH_FALSE_NORTHING_METERS : 0;
  return {
    x: UTM_FALSE_EASTING_METERS + UTM_SCALE_FACTOR * RECTIFYING_RADIUS_METERS * eta,
    y: falseNorthing + UTM_SCALE_FACTOR * RECTIFYING_RADIUS_METERS * xi,
  };
}
