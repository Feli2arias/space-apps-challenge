import {
  clamp,
  createGrid,
  createRandom,
  plot,
  stamp,
  Tone,
  type Frame,
  type PixelGrid,
  type ToneIndex,
} from "./grid";

/** Backdrop for the hero: outlined clouds and small plus-shaped markers that twinkle. */

const CLOUD_LARGE = [
  "..........OOOOOO............",
  "........OO......OO..........",
  "...OOOO.O.........O.........",
  "..O....O...........OOOO.....",
  ".O.....................O....",
  "O.......................O...",
  "O.......................O...",
  ".OOOOOOOOOOOOOOOOOO..OOOO...",
] as const;

const CLOUD_SMALL = [
  "......OOOO.......",
  "..OOOO....O......",
  ".O.........OOO...",
  "O.............O..",
  ".OOOOOOOO..OOOO..",
] as const;

interface CloudPlacement {
  readonly bitmap: readonly string[];
  readonly x: number;
  readonly y: number;
  /** Clouds marked wide only appear when there is room beside the headline. */
  readonly wideOnly: boolean;
}

const CLOUDS: readonly CloudPlacement[] = [
  { bitmap: CLOUD_LARGE, x: 0.015, y: 0.22, wideOnly: false },
  { bitmap: CLOUD_SMALL, x: 0.57, y: 0.115, wideOnly: true },
  { bitmap: CLOUD_LARGE, x: 0.69, y: 0.4, wideOnly: false },
  { bitmap: CLOUD_SMALL, x: 0.285, y: 0.47, wideOnly: true },
];

const WIDE_GRID = 200;
const SKY_SEED = 20261114;
/** Markers stay in the upper part of the section, clear of the landscape below. */
const SKY_DEPTH = 0.6;

function drawPlus(grid: PixelGrid, x: number, y: number, arm: number, tone: ToneIndex): void {
  for (let offset = -arm; offset <= arm; offset += 1) {
    plot(grid, x + offset, y, tone);
    plot(grid, x, y + offset, tone);
  }
}

export function drawSky(frame: Frame): PixelGrid {
  const grid = createGrid(frame.width, frame.height);
  if (grid.width === 0 || grid.height === 0) return grid;

  const { width, height } = grid;
  const random = createRandom(SKY_SEED);

  CLOUDS.forEach((cloud) => {
    if (cloud.wideOnly && width < WIDE_GRID) return;
    stamp(grid, cloud.bitmap, Math.round(width * cloud.x), Math.round(height * cloud.y), {
      O: Tone.stone,
    });
  });

  const markers = clamp(Math.round((width * height) / 2400), 6, 24);
  for (let index = 0; index < markers; index += 1) {
    const x = Math.round(random() * (width - 1));
    const y = Math.round(random() * height * SKY_DEPTH);
    const arm = random() < 0.35 ? 2 : 1;
    const tone = random() < 0.3 ? Tone.cinnabar : Tone.stone;
    const phase = Math.floor(random() * 10);
    // Each marker grows by one pixel for one beat out of ten.
    const twinkle = (frame.tick + phase) % 10 === 0 ? 1 : 0;
    drawPlus(grid, x, y, arm + twinkle, tone);
  }

  return grid;
}
