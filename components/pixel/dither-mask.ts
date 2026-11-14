import { bitmapToPath, dither } from "./grid";

/** Columns in one tile; the 4×4 Bayer matrix repeats every four pixels. */
const TILE_COLUMNS = 4;

/**
 * Rows of a dissolve from solid (top) to empty (bottom) as a bitmap: "#" keeps
 * the pixel. Each row keeps a little less, in the same ordered-dither pattern
 * the canvas scenes use, so the strip reads as part of the same drawing.
 */
export function ditherFadeBitmap(rows: number): string[] {
  const safeRows = Math.max(1, Math.floor(rows));
  return Array.from({ length: safeRows }, (_, y) => {
    const keep = 1 - (y + 1) / (safeRows + 1);
    return Array.from({ length: TILE_COLUMNS }, (_, x) => (dither(x, y, keep) ? "#" : ".")).join(
      "",
    );
  });
}

/**
 * A CSS mask (`url(...)`) for one tile of the dissolve. The mask only carries
 * the shape; the colour comes from the element's background token.
 */
export function ditherFadeMask(rows: number): string {
  const bitmap = ditherFadeBitmap(rows);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE_COLUMNS} ${bitmap.length}" ` +
    `shape-rendering="crispEdges"><path d="${bitmapToPath(bitmap)}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export const DITHER_TILE_COLUMNS = TILE_COLUMNS;
