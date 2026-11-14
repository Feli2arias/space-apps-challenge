import type { QaBitfield } from "./landsat-stac";

/**
 * Cloud and quality mask from the QA_PIXEL band of Landsat Collection 2.
 *
 * Each pixel of that band is a 16-bit number where single bits flag a
 * condition (fill, cloud, cloud shadow…). The position of every bit is read
 * from the scene's own metadata (`classification:bitfields`), which matches the
 * USGS table "Landsat 8-9 OLI/TIRS Collection 2 Pixel Quality Assessment":
 * https://www.usgs.gov/landsat-missions/landsat-collection-2-quality-assessment-bands
 */

/**
 * A pixel is rejected when any of these flags is set: it holds no image
 * (fill), or what the satellite saw there was not the ground (cloud, the ring
 * around a cloud, high-confidence cirrus, cloud shadow, snow or ice).
 * Water is not rejected: a flooded field is a real observation of the plot.
 */
export const REJECTED_QA_FLAGS = [
  "fill",
  "dilated_cloud",
  "cirrus",
  "cloud",
  "cloud_shadow",
  "snow",
] as const;

/** QA_PIXEL is an unsigned 16-bit band, so a flag can only sit on bits 0 to 15. */
const QA_BAND_BITS = 16;

/**
 * The number whose set bits are the rejected flags, or `null` when the scene
 * does not describe every one of them as a single bit. Without the full
 * description the mask cannot be trusted, so the scene is not used.
 */
export function buildRejectMask(bitfields: readonly QaBitfield[]): number | null {
  let mask = 0;
  for (const flag of REJECTED_QA_FLAGS) {
    const field = bitfields.find((candidate) => candidate.name === flag);
    if (!field || field.length !== 1 || field.offset >= QA_BAND_BITS) return null;
    mask |= 1 << field.offset;
  }
  return mask;
}

/** True when none of the rejected flags is set in the pixel's quality value. */
export function isClearQa(qaValue: number, rejectMask: number): boolean {
  return (qaValue & rejectMask) === 0;
}
