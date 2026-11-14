import { furrowX, type Layout } from "./field-layout";
import { drawLine, fillRect, plot, toneAt, type PixelGrid, type ToneIndex } from "./grid";

/**
 * The satellite reading the hero parcel.
 *
 * The satellite holds station to the right of the parcel, looking down at it
 * at an angle, with a one-pixel bob. On a short loop it rests briefly on a
 * finished reading, clears it, then reads the parcel
 * again: a scan line runs from the far edge to the near edge, always spanning
 * exactly from one side of the parcel to the other, with the two rays of the
 * beam landing on its ends. Behind the line the dashed outline turns solid and
 * a few sample cells flash and stay marked. Nothing is drawn outside the parcel
 * except the beam itself. Everything is a pure function of the layout and the tick.
 */

export interface ScanTones {
  readonly accent: ToneIndex;
  readonly accentDeep: ToneIndex;
  readonly light: ToneIndex;
  readonly body: ToneIndex;
  /** Furrow tone on the soil; furrows light up just behind the scan line. */
  readonly furrow: ToneIndex;
}

export interface Parcel {
  /** Furrow indexes of the left and right edges. */
  readonly left: number;
  readonly right: number;
  /** Rows of the top and bottom edges. */
  readonly top: number;
  readonly bottom: number;
}

export type ScanPhase = "measured" | "cleared" | "scanning";

export interface ScanState {
  readonly phase: ScanPhase;
  /** Left column and top row of the satellite sprite. */
  readonly x: number;
  readonly y: number;
  /** Column under the middle of the satellite. */
  readonly centerX: number;
  /** Row of the scan line while scanning, otherwise null. */
  readonly scanRow: number | null;
  /** Ticks since the scan line left the far edge; negative when nothing has been read. */
  readonly scanTick: number;
  readonly beam: boolean;
  readonly light: boolean;
}

const SATELLITE = [
  ".......L.......",
  ".......B.......",
  "PPPPP.BBB.PPPPP",
  "P.P.PBBBBBP.P.P",
  "PPPPP.BBB.PPPPP",
  "......B.B......",
] as const;

const SPRITE_WIDTH = SATELLITE[0].length;
const SPRITE_HALF = Math.floor(SPRITE_WIDTH / 2);
const PANEL_ROWS = [2, 4] as const;
const PANEL_WIDTH = 5;

/** Loop, in ticks of the hero canvas (150 ms): rest on the reading, clear it, read again. */
export const MEASURED_TICKS = 12;
export const CLEARED_TICKS = 3;
export const SCAN_TICKS = 14;
export const SCAN_CYCLE = MEASURED_TICKS + CLEARED_TICKS + SCAN_TICKS;

const BOB_PERIOD = 6;
/** Where the satellite hangs, as a share of the canvas: right of the parcel, clear of the sun. */
const STATION_X = 0.63;
const STATION_Y = 0.1;
const BLINK_PERIOD = 8;
/** Rows behind the scan line whose furrows stay lit. */
const TRAIL_ROWS = 2;
const FLASH_TICKS = 2;
const AFTERGLOW_TICKS = 4;
/** Sample rows inside the parcel, as a share of its height. */
const SAMPLE_ROWS = [0.22, 0.52, 0.82] as const;

export function createParcel(layout: Layout): Parcel {
  const depth = layout.height - layout.horizon;
  return {
    left: -1,
    right: 2,
    top: layout.horizon + Math.round(depth * 0.26),
    bottom: layout.horizon + Math.round(depth * 0.68),
  };
}

function edgeX(layout: Layout, index: number, y: number): number {
  return Math.round(furrowX(layout, index, y));
}

/** Satellite position, phase and scan line for one tick. The still frame (tick 0) is a finished reading. */
export function scanState(layout: Layout, parcel: Parcel, tick: number): ScanState {
  const elapsed = ((tick % SCAN_CYCLE) + SCAN_CYCLE) % SCAN_CYCLE;
  const scanStart = MEASURED_TICKS + CLEARED_TICKS;
  let phase: ScanPhase = "measured";
  if (elapsed >= scanStart) phase = "scanning";
  else if (elapsed >= MEASURED_TICKS) phase = "cleared";

  let scanTick = -1;
  if (phase === "scanning") scanTick = elapsed - scanStart;
  else if (phase === "measured") scanTick = SCAN_TICKS + elapsed;

  const span = parcel.bottom - parcel.top;
  const scanRow =
    phase === "scanning" ? parcel.top + Math.round((scanTick / (SCAN_TICKS - 1)) * span) : null;

  const centerX = Math.round(layout.width * STATION_X);
  const bob = Math.floor(elapsed / BOB_PERIOD) % 2;

  return {
    phase,
    x: centerX - SPRITE_HALF,
    y: Math.max(1, Math.round(layout.height * STATION_Y)) + bob,
    centerX,
    scanRow,
    scanTick,
    beam: phase === "scanning",
    light: elapsed % BLINK_PERIOD === 0,
  };
}

/** Ticks since the scan line reached row `y`; negative before it gets there. */
export function rowAge(state: ScanState, parcel: Parcel, y: number): number {
  if (state.scanTick < 0) return -1;
  const span = Math.max(1, parcel.bottom - parcel.top);
  // Inverse of the scan row formula: the first tick whose rounded row reaches `y`.
  const reachedAt = Math.max(0, Math.ceil(((y - parcel.top - 0.5) * (SCAN_TICKS - 1)) / span));
  return state.scanTick - reachedAt;
}

function drawBeam(
  grid: PixelGrid,
  layout: Layout,
  parcel: Parcel,
  state: ScanState,
  tones: ScanTones,
): void {
  if (state.scanRow === null) return;
  const row = state.scanRow;
  const leftX = edgeX(layout, parcel.left, row);
  const rightX = edgeX(layout, parcel.right, row);
  const originY = state.y + SATELLITE.length;
  const dotted = (step: number) => (step % 2 === 0 ? tones.accent : null);
  drawLine(grid, state.centerX, originY, leftX, row - 1, dotted);
  drawLine(grid, state.centerX, originY, rightX, row - 1, dotted);

  // Furrows just behind the line stay lit, clipped to the inside of the parcel.
  for (let y = Math.max(parcel.top + 1, row - TRAIL_ROWS); y < row; y += 1) {
    for (let x = edgeX(layout, parcel.left, y) + 1; x < edgeX(layout, parcel.right, y); x += 1) {
      if (toneAt(grid, x, y) === tones.furrow) plot(grid, x, y, tones.light);
    }
  }
  fillRect(grid, leftX + 1, row, rightX - leftX - 1, 1, tones.light);
}

function drawOutline(
  grid: PixelGrid,
  layout: Layout,
  parcel: Parcel,
  state: ScanState,
  tones: ScanTones,
): void {
  const read = (y: number) => rowAge(state, parcel, y) >= 0;
  // Dashes run along each edge; read stretches turn solid.
  ([parcel.top, parcel.bottom] as const).forEach((y) => {
    for (let x = edgeX(layout, parcel.left, y); x <= edgeX(layout, parcel.right, y); x += 1) {
      if (read(y) || (x & 3) < 2) plot(grid, x, y, tones.accent);
    }
  });
  ([parcel.left, parcel.right] as const).forEach((index) => {
    for (let y = parcel.top; y < parcel.bottom; y += 1) {
      if (!read(y) && (y & 3) >= 2) continue;
      drawLine(grid, edgeX(layout, index, y), y, edgeX(layout, index, y + 1), y + 1, () => tones.accent);
    }
  });
}

function drawCorners(
  grid: PixelGrid,
  layout: Layout,
  parcel: Parcel,
  state: ScanState,
  tones: ScanTones,
): void {
  [parcel.top, parcel.bottom].forEach((y) => {
    if (rowAge(state, parcel, y) < 0) return;
    [parcel.left, parcel.right].forEach((index) => {
      const x = edgeX(layout, index, y);
      fillRect(grid, x - 1, y - 1, 3, 3, tones.light);
      plot(grid, x, y, tones.accent);
    });
  });
}

/** A few cells inside the parcel flash as the line passes; every other one stays marked. */
function drawSamples(
  grid: PixelGrid,
  layout: Layout,
  parcel: Parcel,
  state: ScanState,
  tones: ScanTones,
): void {
  SAMPLE_ROWS.forEach((share, row) => {
    const y = Math.round(parcel.top + share * (parcel.bottom - parcel.top));
    const age = rowAge(state, parcel, y);
    if (age < 0) return;
    const size = row === 0 ? 1 : 2;
    for (let column = 0; column < parcel.right - parcel.left; column += 1) {
      const x = edgeX(layout, parcel.left + column + 0.5, y);
      const kept = (row + column) % 2 === 0;
      let tone: ToneIndex | null = null;
      if (age < FLASH_TICKS) tone = tones.light;
      else if (kept) tone = tones.accent;
      else if (age < FLASH_TICKS + AFTERGLOW_TICKS) tone = tones.accentDeep;
      if (tone !== null) fillRect(grid, x - (size - 1), y, size, size, tone);
    }
  });
}

function isPanelGap(row: number, column: number): boolean {
  const inPanelRows = row >= PANEL_ROWS[0] && row <= PANEL_ROWS[1];
  const inPanel = column < PANEL_WIDTH || column >= SPRITE_WIDTH - PANEL_WIDTH;
  return inPanelRows && inPanel && SATELLITE[row][column] === ".";
}

/**
 * Stamps the satellite. Where it overlaps something already in the accent tone
 * the panels turn dark, so it reads as a silhouette instead of melting into it.
 */
function drawSatellite(grid: PixelGrid, state: ScanState, tones: ScanTones): void {
  SATELLITE.forEach((row, rowIndex) => {
    const y = state.y + rowIndex;
    for (let column = 0; column < row.length; column += 1) {
      const x = state.x + column;
      const behind = toneAt(grid, x, y);
      const pixel = row[column];
      if (pixel === "B") plot(grid, x, y, tones.body);
      else if (pixel === "P") plot(grid, x, y, behind === tones.accent ? tones.body : tones.accent);
      else if (pixel === "L" && state.light) plot(grid, x, y, tones.accent);
      else if (behind === tones.accent && isPanelGap(rowIndex, column)) plot(grid, x, y, tones.body);
    }
  });
}

export function drawScan(
  grid: PixelGrid,
  layout: Layout,
  parcel: Parcel,
  tones: ScanTones,
  tick: number,
): void {
  const state = scanState(layout, parcel, tick);
  if (state.beam) drawBeam(grid, layout, parcel, state, tones);
  drawOutline(grid, layout, parcel, state, tones);
  drawSamples(grid, layout, parcel, state, tones);
  drawCorners(grid, layout, parcel, state, tones);
  drawSatellite(grid, state, tones);
}
