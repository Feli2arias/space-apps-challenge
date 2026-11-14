import type { SceneWindowPixels } from "./landsat-pixels";
import { isClearQa } from "./landsat-qa";
import type { BandScaling } from "./landsat-stac";

/**
 * NDVI of the pixels of one scene.
 *
 * NDVI = (NIR − Red) / (NIR + Red), computed on surface reflectance, that is,
 * after applying the scale and offset each scene publishes for its bands.
 * Computing it on the stored integers would give a different, wrong number
 * because of the offset.
 */

/**
 * Surface reflectance is the share of light a surface sends back, so it lies
 * between 0 and 1. USGS states the same limits as stored values 7273 to 43636
 * ("How do I use a scale factor with Landsat Level-2 science products?",
 * https://www.usgs.gov/faqs/how-do-i-use-a-scale-factor-landsat-level-2-science-products).
 * Values outside are artefacts of the atmospheric correction (very dark or
 * saturated pixels) and make the index meaningless.
 */
export const VALID_REFLECTANCE = { min: 0, max: 1 } as const;

export interface NdviStats {
  /** Mean, lowest and highest NDVI of the clear pixels. `null` when there is none. */
  readonly mean: number | null;
  readonly min: number | null;
  readonly max: number | null;
  /** Pixels of the area that passed the quality mask and had valid reflectance. */
  readonly clearPixels: number;
}

export const NO_CLEAR_PIXELS: NdviStats = { mean: null, min: null, max: null, clearPixels: 0 };

/** Stored integer to surface reflectance. `null` for "no data" and for values outside the valid range. */
export function toReflectance(stored: number, scaling: BandScaling): number | null {
  if (stored === scaling.nodata) return null;
  const reflectance = stored * scaling.scale + scaling.offset;
  const isValid = reflectance >= VALID_REFLECTANCE.min && reflectance <= VALID_REFLECTANCE.max;
  return isValid ? reflectance : null;
}

/** NDVI from two reflectances. `null` when both are zero (the ratio is undefined). */
export function ndvi(nir: number, red: number): number | null {
  const sum = nir + red;
  return sum === 0 ? null : (nir - red) / sum;
}

interface NdviInputs {
  readonly pixels: SceneWindowPixels;
  /** One flag per pixel of the window: true when the pixel belongs to the area. */
  readonly inside: readonly boolean[];
  readonly red: BandScaling;
  readonly nir: BandScaling;
  /** Bits of QA_PIXEL that reject a pixel (see landsat-qa). */
  readonly rejectMask: number;
}

/** NDVI of one pixel, or `null` when it is outside the area, masked or invalid. */
function pixelNdvi(index: number, inputs: NdviInputs): number | null {
  const { pixels } = inputs;
  if (!inputs.inside[index]) return null;
  if (!isClearQa(pixels.qa[index], inputs.rejectMask)) return null;
  const red = toReflectance(pixels.red[index], inputs.red);
  const nir = toReflectance(pixels.nir[index], inputs.nir);
  return red === null || nir === null ? null : ndvi(nir, red);
}

/** Mean, minimum and maximum NDVI over the clear pixels of the area in one scene. */
export function computeNdviStats(inputs: NdviInputs): NdviStats {
  let clearPixels = 0;
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < inputs.pixels.width * inputs.pixels.height; index += 1) {
    const value = pixelNdvi(index, inputs);
    if (value === null) continue;
    clearPixels += 1;
    sum += value;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  if (clearPixels === 0) return NO_CLEAR_PIXELS;
  return { mean: sum / clearPixels, min, max, clearPixels };
}
