/**
 * Low-resolution pixel buffer used by the canvas scenes.
 *
 * A grid is a scratch buffer owned by the scene that creates it: a scene builds
 * a fresh grid for every frame, draws into it and hands it to the renderer.
 * Nothing outside that one frame ever holds a reference to it.
 */

/** Palette slots. Each one maps to a colour token in `app/globals.css`. */
export const Tone = {
  clear: 0,
  paper: 1,
  mist: 2,
  stone: 3,
  cinnabar: 4,
  cinnabarDeep: 5,
  ink: 6,
  white: 7,
} as const;

export type ToneIndex = (typeof Tone)[keyof typeof Tone];

export interface PixelGrid {
  readonly width: number;
  readonly height: number;
  readonly cells: Uint8Array;
}

export interface Frame {
  readonly width: number;
  readonly height: number;
  readonly tick: number;
}

export function createGrid(width: number, height: number): PixelGrid {
  const safeWidth = Math.max(0, Math.floor(width));
  const safeHeight = Math.max(0, Math.floor(height));
  return {
    width: safeWidth,
    height: safeHeight,
    cells: new Uint8Array(safeWidth * safeHeight),
  };
}

export function toneAt(grid: PixelGrid, x: number, y: number): ToneIndex {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return Tone.clear;
  return grid.cells[y * grid.width + x] as ToneIndex;
}

/** Sets one pixel. Coordinates outside the grid are ignored. */
export function plot(grid: PixelGrid, x: number, y: number, tone: ToneIndex): void {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= grid.width || py >= grid.height) return;
  grid.cells[py * grid.width + px] = tone;
}

export function fillRect(
  grid: PixelGrid,
  x: number,
  y: number,
  width: number,
  height: number,
  tone: ToneIndex,
): void {
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      plot(grid, x + column, y + row, tone);
    }
  }
}

/**
 * Draws a line with Bresenham's algorithm. `pick` receives the step number and
 * returns the tone for that pixel, or `null` to leave a gap (dashes, dots).
 */
export function drawLine(
  grid: PixelGrid,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  pick: (step: number) => ToneIndex | null,
): void {
  let x = Math.round(fromX);
  let y = Math.round(fromY);
  const endX = Math.round(toX);
  const endY = Math.round(toY);
  const deltaX = Math.abs(endX - x);
  const deltaY = -Math.abs(endY - y);
  const stepX = x < endX ? 1 : -1;
  const stepY = y < endY ? 1 : -1;
  let error = deltaX + deltaY;
  // Upper bound on the number of pixels in the line; guards against bad input.
  const maxSteps = deltaX - deltaY + 1;

  for (let step = 0; step < maxSteps; step += 1) {
    const tone = pick(step);
    if (tone !== null) plot(grid, x, y, tone);
    if (x === endX && y === endY) return;
    const doubled = 2 * error;
    if (doubled >= deltaY) {
      error += deltaY;
      x += stepX;
    }
    if (doubled <= deltaX) {
      error += deltaX;
      y += stepY;
    }
  }
}

/** Copies a text bitmap into the grid. Characters missing from `legend` are transparent. */
export function stamp(
  grid: PixelGrid,
  bitmap: readonly string[],
  x: number,
  y: number,
  legend: Readonly<Record<string, ToneIndex>>,
): void {
  bitmap.forEach((row, rowIndex) => {
    for (let column = 0; column < row.length; column += 1) {
      const tone = legend[row[column]];
      if (tone !== undefined) plot(grid, x + column, y + rowIndex, tone);
    }
  });
}

const BAYER_4X4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

/**
 * Ordered dithering. Returns true for roughly `level` (0 to 1) of the pixels,
 * in a fixed pattern, so two tones can blend without adding a third colour.
 */
export function dither(x: number, y: number, level: number): boolean {
  const threshold = (BAYER_4X4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  return threshold < level;
}

/** Deterministic pseudo-random generator (mulberry32), so scenes never flicker between renders. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Turns a text bitmap into an SVG path, merging horizontal runs of filled pixels. */
export function bitmapToPath(bitmap: readonly string[]): string {
  const segments: string[] = [];
  bitmap.forEach((row, y) => {
    let runStart = -1;
    for (let x = 0; x <= row.length; x += 1) {
      const filled = x < row.length && row[x] !== ".";
      if (filled && runStart === -1) runStart = x;
      if (!filled && runStart !== -1) {
        const length = x - runStart;
        segments.push(`M${runStart} ${y}h${length}v1h-${length}z`);
        runStart = -1;
      }
    }
  });
  return segments.join("");
}

export function bitmapSize(bitmap: readonly string[]): { width: number; height: number } {
  return {
    width: bitmap.reduce((widest, row) => Math.max(widest, row.length), 0),
    height: bitmap.length,
  };
}
