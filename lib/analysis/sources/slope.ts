import type { SlopeClass, SlopeClassShare } from "../types";

/**
 * Slope from a grid of elevations. Pure maths: no network, no geography
 * beyond the distance in metres between neighbouring samples.
 *
 * The grid is stored row by row starting at the north-west corner, so index
 * `row * columns + column` grows eastwards first and then southwards. A cell
 * with no elevation is `null`; it is never treated as zero.
 */

/** Distance in metres between neighbouring samples, west–east (x) and north–south (y). */
export interface GridSpacing {
  readonly x: number;
  readonly y: number;
}

export interface NumberSummary {
  readonly mean: number;
  readonly min: number;
  readonly max: number;
}

/**
 * Horn's weights: the row or column through the centre counts double, and the
 * three weighted differences add up to 8 cell widths.
 * Horn, B.K.P. (1981), "Hill shading and the reflectance map", Proc. IEEE 69(1).
 */
const HORN_CENTRE_WEIGHT = 2;
const HORN_DIVISOR = 8;

const PERCENT_PER_UNIT_RATIO = 100;
const DEGREES_PER_RADIAN = 180 / Math.PI;

/**
 * Lower bounds of the four slope classes, in percent. They are class limits of
 * FAO, "Guidelines for soil description" (4th ed., 2006), Table 7 "Slope
 * gradient classes", grouped into four so they read at a glance:
 * - flat: under 2 % (FAO "flat" to "very gently sloping")
 * - gentle: 2 to 5 % (FAO "gently sloping")
 * - moderate: 5 to 15 % (FAO "sloping" and "strongly sloping")
 * - steep: 15 % and over (FAO "moderately steep" and beyond)
 */
export const SLOPE_CLASS_BOUNDS: readonly {
  readonly slopeClass: SlopeClass;
  readonly fromPercent: number;
  readonly toPercent: number | null;
}[] = [
  { slopeClass: "flat", fromPercent: 0, toPercent: 2 },
  { slopeClass: "gentle", fromPercent: 2, toPercent: 5 },
  { slopeClass: "moderate", fromPercent: 5, toPercent: 15 },
  { slopeClass: "steep", fromPercent: 15, toPercent: null },
];

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Slope at the centre of a 3×3 window, as rise over run (0.1 means 10 %).
 *
 * `window` holds the nine elevations row by row, north-west first:
 *
 *     a b c
 *     d e f
 *     g h i
 *
 * Horn's method estimates the west–east and north–south gradients from the
 * eight neighbours, which smooths out the noise of a single pixel. Returns
 * `null` when any of the nine values is missing: a slope is never guessed.
 */
export function hornSlopeRatio(
  window: readonly (number | null | undefined)[],
  spacing: GridSpacing,
): number | null {
  if (window.length !== 9 || !window.every(isNumber)) return null;
  if (!(spacing.x > 0) || !(spacing.y > 0)) return null;
  const [a, b, c, d, , f, g, h, i] = window as readonly number[];

  const eastMinusWest = c + HORN_CENTRE_WEIGHT * f + i - (a + HORN_CENTRE_WEIGHT * d + g);
  const southMinusNorth = g + HORN_CENTRE_WEIGHT * h + i - (a + HORN_CENTRE_WEIGHT * b + c);
  const gradientX = eastMinusWest / (HORN_DIVISOR * spacing.x);
  const gradientY = southMinusNorth / (HORN_DIVISOR * spacing.y);
  return Math.hypot(gradientX, gradientY);
}

/**
 * Slope (rise over run) of every cell of the grid. Cells on the border of the
 * grid, and cells with a missing value in their 3×3 window, are `null`.
 */
export function slopeRatioGrid(
  elevations: readonly (number | null)[],
  columns: number,
  rows: number,
  spacing: GridSpacing,
): readonly (number | null)[] {
  if (elevations.length !== columns * rows) {
    throw new RangeError(
      `Expected ${columns * rows} elevations for a ${columns}×${rows} grid, got ${elevations.length}.`,
    );
  }
  const windowOffsets = [-1, 0, 1];

  return elevations.map((_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const isBorder = row === 0 || column === 0 || row === rows - 1 || column === columns - 1;
    if (isBorder) return null;

    const window = windowOffsets.flatMap((rowOffset) =>
      windowOffsets.map(
        (columnOffset) => elevations[(row + rowOffset) * columns + (column + columnOffset)],
      ),
    );
    return hornSlopeRatio(window, spacing);
  });
}

/** Rise over run to percent: 0.1 → 10 %. A 45° slope is 100 %. */
export function ratioToPercent(ratio: number): number {
  return ratio * PERCENT_PER_UNIT_RATIO;
}

/** Rise over run to the angle above the horizontal, in degrees: 1 → 45°. */
export function ratioToDegrees(ratio: number): number {
  return Math.atan(ratio) * DEGREES_PER_RADIAN;
}

export function classifySlopePercent(percent: number): SlopeClass {
  const match = SLOPE_CLASS_BOUNDS.find(
    (bounds) => percent >= bounds.fromPercent && (bounds.toPercent === null || percent < bounds.toPercent),
  );
  // Slopes are never negative, so only a NaN could miss every class.
  return match?.slopeClass ?? "flat";
}

/**
 * Share of the cells in each slope class (0 to 1), always in the same order.
 * Returns an empty list when there is no slope to classify, so that "no
 * slope was computed" is never shown as "0 % of the land is steep".
 */
export function slopeClassShares(slopesPercent: readonly number[]): readonly SlopeClassShare[] {
  if (slopesPercent.length === 0) return [];
  const classes = slopesPercent.map(classifySlopePercent);
  return SLOPE_CLASS_BOUNDS.map((bounds) => ({
    ...bounds,
    share: classes.filter((slopeClass) => slopeClass === bounds.slopeClass).length / classes.length,
  }));
}

/** Mean, minimum and maximum of a list. `null` for an empty list. */
export function summarise(values: readonly number[]): NumberSummary | null {
  if (values.length === 0) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return {
    mean: sum / values.length,
    min: values.reduce((lowest, value) => Math.min(lowest, value), Infinity),
    max: values.reduce((highest, value) => Math.max(highest, value), -Infinity),
  };
}

/** Rounds to a fixed number of decimals, so results do not suggest more precision than the data has. */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
