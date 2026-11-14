import { createLayout, fadeRows, furrowX, type Layout } from "./field-layout";
import { createParcel, drawScan, type ScanTones } from "./scan";
import {
  clamp,
  createGrid,
  dither,
  drawLine,
  fillRect,
  plot,
  Tone,
  type Frame,
  type PixelGrid,
  type ToneIndex,
} from "./grid";

/**
 * A farm seen from the edge of the field: far hills, a ploughed field whose
 * furrows run to the horizon, maize swaying in a light wind at the edges and, in the hero, a parcel
 * outlined in the soil with a satellite passing over it.
 */

interface FieldTones {
  readonly far: ToneIndex;
  readonly mid: ToneIndex;
  /** Second tone checkered into the near hills; equal to `mid` for a flat fill. */
  readonly midAlt: ToneIndex;
  /** Light tone at the top of the field, dithered down into `ground`. */
  readonly haze: ToneIndex;
  readonly ground: ToneIndex;
  readonly furrow: ToneIndex;
  readonly accent: ToneIndex;
  readonly light: ToneIndex;
  readonly plant: ToneIndex;
}

interface FieldOptions {
  readonly tones: FieldTones;
  readonly sun: boolean;
  /** Parcel outline and the satellite pass that reads it. */
  readonly parcel: boolean;
  /** Seedlings along every furrow, for the closing scene. */
  readonly sprouts: boolean;
  /** Dissolve the bottom rows into the ground tone so the art joins the band below. */
  readonly fade: boolean;
}

const HERO: FieldOptions = {
  tones: {
    far: Tone.mist,
    mid: Tone.stone,
    midAlt: Tone.stone,
    haze: Tone.stone,
    ground: Tone.ink,
    furrow: Tone.stone,
    accent: Tone.cinnabar,
    light: Tone.white,
    plant: Tone.ink,
  },
  sun: true,
  parcel: true,
  sprouts: false,
  fade: true,
};

const CLOSING: FieldOptions = {
  tones: {
    far: Tone.cinnabarDeep,
    mid: Tone.ink,
    midAlt: Tone.cinnabarDeep,
    haze: Tone.cinnabarDeep,
    ground: Tone.ink,
    furrow: Tone.cinnabar,
    accent: Tone.cinnabar,
    light: Tone.white,
    plant: Tone.ink,
  },
  sun: false,
  parcel: false,
  sprouts: true,
  fade: false,
};

const MIN_FURROW_GAP = 4;
const SOLID: (tone: ToneIndex) => () => ToneIndex = (tone) => () => tone;
const MIN_WIDTH_FOR_PLANTS = 70;
const WIDTH_FOR_PLANT_PAIRS = 160;

/** Maize plants as [x position, top of the plant], both as a share of the canvas. */
type PlantPlacement = readonly [number, number];
const ALL_PLANTS: readonly PlantPlacement[] = [
  [0.035, 0.1],
  [0.1, 0.3],
  [0.915, 0.24],
  [0.968, 0.06],
];
const OUTER_PLANTS: readonly PlantPlacement[] = [
  [0.06, 0.14],
  [0.94, 0.1],
];

function drawFarHills(grid: PixelGrid, layout: Layout, tone: ToneIndex): void {
  const { width, height, horizon } = layout;
  for (let x = 0; x < width; x += 1) {
    const u = x / width;
    const rise =
      height * (0.2 + 0.09 * Math.sin(u * 7.3 + 0.6) + 0.04 * Math.sin(u * 19 + 2));
    const top = horizon - Math.round(rise);
    fillRect(grid, x, top, 1, horizon - top, tone);
  }
}

function drawSun(grid: PixelGrid, layout: Layout, tone: ToneIndex, tick: number): void {
  const { width, height, horizon } = layout;
  const radius = clamp(Math.round(height * 0.12), 4, 10);
  const centerX = Math.round(width * 0.25);
  const centerY = horizon - Math.round(height * 0.19);
  const reach = radius * radius + radius * 0.6;

  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx * dx + dy * dy <= reach) plot(grid, centerX + dx, centerY + dy, tone);
    }
  }

  // Eight rays that pulse one pixel outwards every few ticks.
  const pulse = Math.floor(tick / 4) % 2;
  for (let ray = 0; ray < 8; ray += 1) {
    const angle = (ray * Math.PI) / 4;
    for (let step = 0; step < 2 + pulse; step += 1) {
      const distance = radius + 3 + step;
      plot(
        grid,
        centerX + Math.cos(angle) * distance,
        centerY + Math.sin(angle) * distance,
        tone,
      );
    }
  }
}

function drawNearHills(grid: PixelGrid, layout: Layout, tones: FieldTones): void {
  const { width, height, horizon } = layout;
  for (let x = 0; x < width; x += 1) {
    const u = x / width;
    const rise =
      height * (0.075 + 0.05 * Math.sin(u * 11 + 4) + 0.025 * Math.sin(u * 29 + 1));
    const top = horizon - Math.round(rise);
    for (let y = top; y < horizon; y += 1) {
      plot(grid, x, y, (x + y) % 2 === 0 ? tones.mid : tones.midAlt);
    }
    // A broken row above the ridge softens the edge the way dithering would.
    if (x % 2 === 0) plot(grid, x, top - 1, tones.mid);
  }
}

function drawGround(grid: PixelGrid, layout: Layout, tones: FieldTones): void {
  const { width, height, horizon } = layout;
  const band = Math.max(3, Math.round(height * 0.16));
  for (let y = horizon; y < height; y += 1) {
    const level = 0.25 + (0.75 * (y - horizon)) / band;
    for (let x = 0; x < width; x += 1) {
      plot(grid, x, y, level >= 1 || dither(x, y, level) ? tones.ground : tones.haze);
    }
  }
}

function drawFurrows(grid: PixelGrid, layout: Layout, options: FieldOptions): void {
  const { width, height, horizon, spacing } = layout;
  const { tones } = options;
  const groundDepth = height - horizon;
  // Furrows far to the side run almost flat and pile up under the horizon;
  // stop adding them once they would sit less than two rows apart.
  const count = clamp(Math.round(Math.sqrt((width * groundDepth) / (4 * spacing))) + 1, 3, 14);
  // Start where neighbouring furrows are far enough apart to read as separate lines.
  const startY = horizon + Math.ceil((MIN_FURROW_GAP / spacing) * groundDepth);
  const endY = height - 1;

  for (let index = -count; index < count; index += 1) {
    const line = index + 0.5;
    const offset = Math.abs(index) * 2;
    drawLine(
      grid,
      furrowX(layout, line, startY),
      startY,
      furrowX(layout, line, endY),
      endY,
      (step) => ((step + offset) % 6 < 4 ? tones.furrow : null),
    );
    if (!options.sprouts) continue;
    // Seedlings sit in the gaps between dashes.
    for (let y = startY + 2; y < endY; y += 3) {
      if ((y + offset) % 2 !== 0) continue;
      const x = Math.round(furrowX(layout, line, y));
      plot(grid, x, y - 1, tones.light);
      plot(grid, x + 1, y - 2, tones.light);
    }
  }
}

/**
 * How far the wind pushes a plant at one tick, in art pixels: -1, 0 or 1. A
 * slow swell sets the strength of the gusts and each plant answers a little
 * after its neighbour, so they do not move as one block.
 */
export function windSway(tick: number, plantIndex: number): number {
  const gust = 0.55 + 0.45 * Math.sin(tick * 0.09);
  return Math.round(Math.sin(tick * 0.42 - plantIndex * 0.9) * 1.15 * gust);
}

function drawLeaf(
  grid: PixelGrid,
  rootX: number,
  rootY: number,
  side: number,
  length: number,
  tone: ToneIndex,
  sway: number,
): void {
  let previousX = rootX;
  let previousY = rootY;
  for (let step = 1; step <= length; step += 1) {
    const u = step / length;
    // Rises out of the stalk, arches over and droops at the tip.
    const lift = Math.sin(u * Math.PI * 0.85) * length * 0.5;
    const droop = u * u * u * length * 0.7;
    // The wind moves the outer half of the leaf: it stretches downwind and lifts upwind.
    const push = u > 0.5 ? sway : 0;
    const x = rootX + side * step + push;
    const y = rootY - Math.round(lift) + Math.round(droop) - (push * side < 0 && u > 0.8 ? 1 : 0);
    drawLine(grid, previousX, previousY, x, y, SOLID(tone));
    if (u < 0.6) plot(grid, x, y + 1, tone);
    previousX = x;
    previousY = y;
  }
}

function drawMaize(
  grid: PixelGrid,
  layout: Layout,
  baseX: number,
  topY: number,
  tone: ToneIndex,
  sway: number,
): void {
  const { height } = layout;
  const thick = height >= 60;
  const stalkWidth = thick ? 2 : 1;
  const leafGap = Math.max(4, Math.round(height * 0.1));
  const longestLeaf = Math.max(6, Math.round(height * 0.2));
  // The top of the stalk leans with the wind; the rest stays planted.
  const bendRows = Math.max(2, Math.round((height - topY) * 0.12));
  const tipX = baseX + sway;

  // Tassel: three short spikes.
  plot(grid, tipX, topY - 1, tone);
  plot(grid, tipX - 1, topY, tone);
  plot(grid, tipX + stalkWidth, topY, tone);
  plot(grid, tipX - 2, topY - 1, tone);
  plot(grid, tipX + stalkWidth + 1, topY - 1, tone);

  fillRect(grid, tipX, topY, stalkWidth, bendRows, tone);
  fillRect(grid, baseX, topY + bendRows, stalkWidth, height - topY - bendRows, tone);

  let side = -1;
  let node = 0;
  for (let leafY = topY + leafGap; leafY < height - 2; leafY += leafGap) {
    // Leaves get longer towards the base of the plant.
    const length = Math.round(longestLeaf * Math.min(1, 0.6 + node * 0.15));
    const rootX = side > 0 ? baseX + stalkWidth - 1 : baseX;
    drawLeaf(grid, rootX, leafY, side, length, tone, sway);
    side = -side;
    node += 1;
  }
}

function drawPlants(grid: PixelGrid, layout: Layout, tone: ToneIndex, tick: number): void {
  const { width, height } = layout;
  if (width < MIN_WIDTH_FOR_PLANTS) return;
  // On narrow canvases a single plant per side keeps the leaves from tangling.
  const plants = width < WIDTH_FOR_PLANT_PAIRS ? OUTER_PLANTS : ALL_PLANTS;
  plants.forEach(([xRatio, topRatio], index) => {
    const sway = windSway(tick, index);
    drawMaize(grid, layout, Math.round(width * xRatio), Math.round(height * topRatio), tone, sway);
  });
}

function scanTones(tones: FieldTones): ScanTones {
  return { accent: tones.accent, accentDeep: Tone.cinnabarDeep, light: tones.light, body: Tone.ink, furrow: tones.furrow };
}

/**
 * Ordered-dither dissolve: over the last rows every pixel that is not ground
 * gives way to the ground tone, a few more per row, so the bottom row is solid
 * ground and the scene runs into the band below without a hard edge.
 */
function fadeBottom(grid: PixelGrid, layout: Layout, ground: ToneIndex): void {
  const rows = Math.min(fadeRows(layout), grid.height);
  for (let row = 0; row < rows; row += 1) {
    const y = grid.height - rows + row;
    // Share of detail that survives in this row: just under 1 at the top, 0 at the bottom.
    const keep = 1 - (row + 1) / rows;
    for (let x = 0; x < grid.width; x += 1) {
      const index = y * grid.width + x;
      if (grid.cells[index] !== ground && !dither(x, y, keep)) grid.cells[index] = ground;
    }
  }
}

function drawField(frame: Frame, options: FieldOptions): PixelGrid {
  const grid = createGrid(frame.width, frame.height);
  if (grid.width === 0 || grid.height === 0) return grid;

  const layout = createLayout(grid.width, grid.height);
  const { tones } = options;

  drawFarHills(grid, layout, tones.far);
  if (options.sun) drawSun(grid, layout, tones.accent, frame.tick);
  drawNearHills(grid, layout, tones);
  drawGround(grid, layout, tones);
  drawFurrows(grid, layout, options);

  if (options.parcel) drawScan(grid, layout, createParcel(layout), scanTones(tones), frame.tick);

  drawPlants(grid, layout, tones.plant, frame.tick);
  if (options.fade) fadeBottom(grid, layout, tones.ground);
  return grid;
}

export function drawHeroField(frame: Frame): PixelGrid {
  return drawField(frame, HERO);
}

export function drawClosingField(frame: Frame): PixelGrid {
  return drawField(frame, CLOSING);
}
