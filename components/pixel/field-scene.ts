import {
  clamp,
  createGrid,
  dither,
  drawLine,
  fillRect,
  plot,
  stamp,
  Tone,
  type Frame,
  type PixelGrid,
  type ToneIndex,
} from "./grid";

/**
 * A farm seen from the edge of the field: far hills, a ploughed field whose
 * furrows run to the horizon, maize at the edges and, in the hero, a parcel
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
  readonly satellite: boolean;
  readonly parcel: boolean;
  /** Seedlings along every furrow, for the closing scene. */
  readonly sprouts: boolean;
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
  satellite: true,
  parcel: true,
  sprouts: false,
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
  satellite: false,
  parcel: false,
  sprouts: true,
};

const SATELLITE = [
  "PPPPP..B..PPPPP",
  "P.P.P.BBB.P.P.P",
  "PPPPPBBBBBPPPPP",
  "P.P.P.BBB.P.P.P",
  "PPPPP.BBB.PPPPP",
  "......BBB......",
  ".....B.B.B.....",
] as const;

const HORIZON_RATIO = 0.44;
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

interface Layout {
  readonly width: number;
  readonly height: number;
  readonly horizon: number;
  readonly vanishX: number;
  /** Distance between furrows at the bottom edge. */
  readonly spacing: number;
}

function createLayout(width: number, height: number): Layout {
  return {
    width,
    height,
    horizon: Math.round(height * HORIZON_RATIO),
    vanishX: width * 0.5,
    spacing: Math.max(12, width / 11),
  };
}

/** Column of furrow line `index` at row `y`; all lines meet at the vanishing point. */
function furrowX(layout: Layout, index: number, y: number): number {
  const depth = (y - layout.horizon) / Math.max(1, layout.height - layout.horizon);
  return layout.vanishX + index * layout.spacing * depth;
}

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

interface Parcel {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

function createParcel(layout: Layout): Parcel {
  const depth = layout.height - layout.horizon;
  return {
    left: -1,
    right: 2,
    top: layout.horizon + Math.round(depth * 0.36),
    bottom: layout.horizon + Math.round(depth * 0.86),
  };
}

function drawParcel(
  grid: PixelGrid,
  layout: Layout,
  parcel: Parcel,
  tones: FieldTones,
  tick: number,
): void {
  const edge = (index: number, y: number) => Math.round(furrowX(layout, index, y));
  const accent = SOLID(tones.accent);

  // Furrows inside the parcel take the accent colour.
  for (let index = parcel.left; index < parcel.right; index += 1) {
    drawLine(
      grid,
      furrowX(layout, index + 0.5, parcel.top),
      parcel.top,
      furrowX(layout, index + 0.5, parcel.bottom),
      parcel.bottom,
      (step) => (step % 3 < 2 ? tones.accent : null),
    );
  }

  const topLeft = edge(parcel.left, parcel.top);
  const topRight = edge(parcel.right, parcel.top);
  const bottomLeft = edge(parcel.left, parcel.bottom);
  const bottomRight = edge(parcel.right, parcel.bottom);

  drawLine(grid, topLeft, parcel.top, bottomLeft, parcel.bottom, accent);
  drawLine(grid, topRight, parcel.top, bottomRight, parcel.bottom, accent);
  fillRect(grid, topLeft, parcel.top, topRight - topLeft + 1, 1, tones.accent);
  fillRect(grid, bottomLeft, parcel.bottom, bottomRight - bottomLeft + 1, 1, tones.accent);

  // A scan line sweeps down the parcel, as if the satellite were reading it.
  const span = Math.max(1, parcel.bottom - parcel.top - 1);
  const scanY = parcel.top + 1 + (tick % span);
  for (let x = edge(parcel.left, scanY) + 1; x < edge(parcel.right, scanY); x += 1) {
    if ((x + tick) % 2 === 0) plot(grid, x, scanY, tones.light);
  }

  // Corner handles, like the ones used to draw a parcel on the map.
  const corners: ReadonlyArray<readonly [number, number]> = [
    [topLeft, parcel.top],
    [topRight, parcel.top],
    [bottomLeft, parcel.bottom],
    [bottomRight, parcel.bottom],
  ];
  corners.forEach(([x, y]) => {
    fillRect(grid, x - 1, y - 1, 3, 3, tones.light);
    plot(grid, x, y, tones.accent);
  });
}

function drawSatellite(
  grid: PixelGrid,
  layout: Layout,
  parcel: Parcel,
  tones: FieldTones,
  tick: number,
): void {
  const spriteWidth = SATELLITE[0].length;
  const bob = Math.floor(tick / 6) % 2;
  const x = Math.round(clamp(layout.width * 0.74, 0, layout.width - spriteWidth - 1));
  const y = Math.max(1, Math.round(layout.height * 0.04)) + bob;

  const targetY = Math.round((parcel.top + parcel.bottom) / 2);
  const targetX = Math.round(furrowX(layout, (parcel.left + parcel.right) / 2, targetY));
  const originX = x + Math.floor(spriteWidth / 2);
  const originY = y + SATELLITE.length + 1;

  // Marching dots: two on, two off, shifting one pixel per tick.
  drawLine(grid, originX, originY, targetX, targetY, (step) =>
    (((step - tick) % 4) + 4) % 4 < 2 ? tones.accent : null,
  );

  stamp(grid, SATELLITE, x, y, { P: tones.accent, B: Tone.ink });
}

function drawLeaf(
  grid: PixelGrid,
  rootX: number,
  rootY: number,
  side: number,
  length: number,
  tone: ToneIndex,
): void {
  let previousX = rootX;
  let previousY = rootY;
  for (let step = 1; step <= length; step += 1) {
    const u = step / length;
    // Rises out of the stalk, arches over and droops at the tip.
    const lift = Math.sin(u * Math.PI * 0.85) * length * 0.5;
    const droop = u * u * u * length * 0.7;
    const x = rootX + side * step;
    const y = rootY - Math.round(lift) + Math.round(droop);
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
): void {
  const { height } = layout;
  const thick = height >= 60;
  const stalkWidth = thick ? 2 : 1;
  const leafGap = Math.max(4, Math.round(height * 0.1));
  const longestLeaf = Math.max(6, Math.round(height * 0.2));

  // Tassel: three short spikes.
  plot(grid, baseX, topY - 1, tone);
  plot(grid, baseX - 1, topY, tone);
  plot(grid, baseX + stalkWidth, topY, tone);
  plot(grid, baseX - 2, topY - 1, tone);
  plot(grid, baseX + stalkWidth + 1, topY - 1, tone);

  fillRect(grid, baseX, topY, stalkWidth, height - topY, tone);

  let side = -1;
  let node = 0;
  for (let leafY = topY + leafGap; leafY < height - 2; leafY += leafGap) {
    // Leaves get longer towards the base of the plant.
    const length = Math.round(longestLeaf * Math.min(1, 0.6 + node * 0.15));
    const rootX = side > 0 ? baseX + stalkWidth - 1 : baseX;
    drawLeaf(grid, rootX, leafY, side, length, tone);
    side = -side;
    node += 1;
  }
}

function drawPlants(grid: PixelGrid, layout: Layout, tone: ToneIndex): void {
  const { width, height } = layout;
  if (width < MIN_WIDTH_FOR_PLANTS) return;
  // On narrow canvases a single plant per side keeps the leaves from tangling.
  const plants = width < WIDTH_FOR_PLANT_PAIRS ? OUTER_PLANTS : ALL_PLANTS;
  plants.forEach(([xRatio, topRatio]) => {
    drawMaize(grid, layout, Math.round(width * xRatio), Math.round(height * topRatio), tone);
  });
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

  if (options.parcel) {
    const parcel = createParcel(layout);
    drawParcel(grid, layout, parcel, tones, frame.tick);
    if (options.satellite) drawSatellite(grid, layout, parcel, tones, frame.tick);
  }

  drawPlants(grid, layout, tones.plant);
  return grid;
}

export function drawHeroField(frame: Frame): PixelGrid {
  return drawField(frame, HERO);
}

export function drawClosingField(frame: Frame): PixelGrid {
  return drawField(frame, CLOSING);
}
