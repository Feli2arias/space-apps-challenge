import { describe, expect, it } from "vitest";
import { createLayout, fadeRows, furrowX } from "./field-layout";
import { drawClosingField, drawHeroField, windSway } from "./field-scene";
import { createParcel, rowAge, SCAN_CYCLE, SCAN_TICKS, scanState } from "./scan";
import { Tone, type Frame, type PixelGrid, type ToneIndex } from "./grid";
import { drawSky } from "./sky-scene";

const DESKTOP: Frame = { width: 360, height: 72, tick: 0 };
const PHONE: Frame = { width: 98, height: 48, tick: 0 };

function count(grid: PixelGrid, tone: ToneIndex): number {
  return grid.cells.reduce((total, cell) => (cell === tone ? total + 1 : total), 0);
}

function bottomRow(grid: PixelGrid): number[] {
  return Array.from(grid.cells.slice((grid.height - 1) * grid.width));
}

describe("drawHeroField", () => {
  it("fills a grid of the requested size", () => {
    const grid = drawHeroField(DESKTOP);
    expect(grid.width).toBe(DESKTOP.width);
    expect(grid.height).toBe(DESKTOP.height);
  });

  it("leaves the sky transparent so the page background shows through", () => {
    const grid = drawHeroField(DESKTOP);
    // The middle of the top row is clear of plants and of the satellite.
    expect(grid.cells[Math.round(DESKTOP.width / 2)]).toBe(Tone.clear);
  });

  it("ends in solid ground so it joins the dark band below it", () => {
    const row = bottomRow(drawHeroField(DESKTOP));
    expect(row.every((cell) => cell === Tone.ink)).toBe(true);
  });

  it("dissolves its detail row by row towards the bottom edge", () => {
    const grid = drawHeroField(DESKTOP);
    const rows = fadeRows(createLayout(DESKTOP.width, DESKTOP.height));
    const detail = (y: number) =>
      Array.from(grid.cells.slice(y * grid.width, (y + 1) * grid.width)).filter(
        (cell) => cell !== Tone.ink,
      ).length;
    const start = grid.height - rows;
    const upper = detail(start - 2) + detail(start - 1);
    const middle = detail(start + Math.floor(rows / 2) - 1) + detail(start + Math.floor(rows / 2));
    const lower = detail(grid.height - 2) + detail(grid.height - 1);
    expect(upper).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(lower);
  });

  it("draws the accent parcel, sun and satellite beam", () => {
    expect(count(drawHeroField(DESKTOP), Tone.cinnabar)).toBeGreaterThan(100);
  });

  it("is deterministic for the same frame", () => {
    expect(drawHeroField(DESKTOP).cells).toEqual(drawHeroField(DESKTOP).cells);
  });

  it("changes between ticks so the scene animates", () => {
    const later: Frame = { ...DESKTOP, tick: 5 };
    expect(drawHeroField(later).cells).not.toEqual(drawHeroField(DESKTOP).cells);
  });

  it("still draws on a phone-sized canvas", () => {
    const grid = drawHeroField(PHONE);
    expect(count(grid, Tone.cinnabar)).toBeGreaterThan(20);
    expect(count(grid, Tone.ink)).toBeGreaterThan(0);
  });

  it("returns an empty grid for a zero-sized canvas", () => {
    expect(drawHeroField({ width: 0, height: 0, tick: 0 }).cells).toHaveLength(0);
  });
});

describe("scanState", () => {
  const layout = createLayout(DESKTOP.width, DESKTOP.height);
  const parcel = createParcel(layout);
  const parcelLeft = Math.round(furrowX(layout, parcel.left, parcel.bottom));
  const parcelRight = Math.round(furrowX(layout, parcel.right, parcel.bottom));
  const cycle = Array.from({ length: SCAN_CYCLE }, (_, tick) => tick);

  it("is a pure function of the tick", () => {
    expect(scanState(layout, parcel, 42)).toEqual(scanState(layout, parcel, 42));
  });

  it("shows a finished reading with the beam off on the still frame", () => {
    const still = scanState(layout, parcel, 0);
    expect(still.phase).toBe("measured");
    expect(still.beam).toBe(false);
    expect(rowAge(still, parcel, parcel.bottom)).toBeGreaterThanOrEqual(0);
  });

  it("keeps the parcel above the dissolving rows", () => {
    expect(parcel.bottom).toBeLessThan(layout.height - fadeRows(layout));
  });

  it("holds station in one spot, to the right of the parcel's middle, through the whole loop", () => {
    const station = scanState(layout, parcel, 0).centerX;
    expect(station).toBeGreaterThan((parcelLeft + parcelRight) / 2);
    expect(station).toBeLessThan(layout.width * 0.75);
    cycle.forEach((tick) => {
      const state = scanState(layout, parcel, tick);
      expect(state.centerX).toBe(station);
      // The sprite only bobs by one pixel.
      expect(Math.abs(state.y - scanState(layout, parcel, 0).y)).toBeLessThanOrEqual(1);
    });
  });

  it("repeats on a short loop", () => {
    expect(scanState(layout, parcel, 5)).toEqual(scanState(layout, parcel, 5 + SCAN_CYCLE));
    // 150 ms per tick: the parcel is read again every 3.5 to 6 seconds.
    expect(SCAN_CYCLE * 0.15).toBeGreaterThanOrEqual(3.5);
    expect(SCAN_CYCLE * 0.15).toBeLessThanOrEqual(6);
  });

  it("runs the scan line from the far edge to the near edge in steps", () => {
    const rows = cycle
      .map((tick) => scanState(layout, parcel, tick).scanRow)
      .filter((row): row is number => row !== null);
    expect(rows[0]).toBe(parcel.top);
    expect(rows[rows.length - 1]).toBe(parcel.bottom);
    rows.slice(1).forEach((row, index) => expect(row).toBeGreaterThanOrEqual(rows[index]));
  });

  it("counts every row up to the scan line as read, and none below it", () => {
    cycle.forEach((tick) => {
      const state = scanState(layout, parcel, tick);
      if (state.scanRow === null) return;
      expect(rowAge(state, parcel, state.scanRow)).toBeGreaterThanOrEqual(0);
      if (state.scanRow < parcel.bottom) {
        expect(rowAge(state, parcel, state.scanRow + 1)).toBeLessThan(0);
      }
    });
  });

  it("points the beam only while scanning", () => {
    cycle.forEach((tick) => {
      const state = scanState(layout, parcel, tick);
      expect(state.beam).toBe(state.phase === "scanning");
    });
  });
});

/** Columns between the maize plants, where nothing but the scan may change. */
const FIELD_LEFT = Math.round(DESKTOP.width * 0.2);
const FIELD_RIGHT = Math.round(DESKTOP.width * 0.8);

describe("drawHeroField scan", () => {
  const layout = createLayout(DESKTOP.width, DESKTOP.height);
  const parcel = createParcel(layout);
  const scanningTick = SCAN_CYCLE - Math.floor(SCAN_TICKS / 2);

  it("lights nothing on the ground outside the parcel; only the beam's rays cross it", () => {
    const resting = drawHeroField({ ...DESKTOP, tick: 0 });
    const scanning = drawHeroField({ ...DESKTOP, tick: scanningTick });
    for (let y = parcel.top; y < DESKTOP.height; y += 1) {
      // The maize at both edges moves with the wind, so only the open field is compared.
      for (let x = FIELD_LEFT; x < FIELD_RIGHT; x += 1) {
        const inside =
          // The outline's corner handles reach one pixel past the edges.
          y <= parcel.bottom + 1 &&
          x >= Math.round(furrowX(layout, parcel.left, y)) - 2 &&
          x <= Math.round(furrowX(layout, parcel.right, y)) + 2;
        if (inside) continue;
        const index = y * DESKTOP.width + x;
        if (scanning.cells[index] !== resting.cells[index]) {
          expect(scanning.cells[index]).toBe(Tone.cinnabar);
        }
      }
    }
  });

  it("draws a white scan line while scanning", () => {
    const state = scanState(layout, parcel, scanningTick);
    const grid = drawHeroField({ ...DESKTOP, tick: scanningTick });
    const row = state.scanRow ?? 0;
    const middle = Math.round(furrowX(layout, (parcel.left + parcel.right) / 2, row));
    expect(grid.cells[row * DESKTOP.width + middle]).toBe(Tone.white);
  });
});

describe("drawClosingField", () => {
  it("shows seedlings along the furrows", () => {
    expect(count(drawClosingField(DESKTOP), Tone.white)).toBeGreaterThan(20);
  });

  it("keeps the open field still between ticks, since it has no parcel, sun or satellite", () => {
    const now = drawClosingField(DESKTOP);
    const later = drawClosingField({ ...DESKTOP, tick: 5 });
    for (let y = 0; y < DESKTOP.height; y += 1) {
      for (let x = FIELD_LEFT; x < FIELD_RIGHT; x += 1) {
        const index = y * DESKTOP.width + x;
        expect(later.cells[index]).toBe(now.cells[index]);
      }
    }
  });

  it("uses the dark cinnabar for its hills instead of the hero grays", () => {
    const grid = drawClosingField(DESKTOP);
    expect(count(grid, Tone.cinnabarDeep)).toBeGreaterThan(0);
    expect(count(grid, Tone.mist)).toBe(0);
    expect(count(grid, Tone.stone)).toBe(0);
  });
});

describe("drawSky", () => {
  it("draws only clouds and markers, leaving most of the sky clear", () => {
    const grid = drawSky({ width: 360, height: 220, tick: 0 });
    const painted = grid.cells.length - count(grid, Tone.clear);
    expect(painted).toBeGreaterThan(0);
    expect(painted / grid.cells.length).toBeLessThan(0.05);
  });

  it("keeps markers out of the lower part of the section", () => {
    const frame: Frame = { width: 200, height: 200, tick: 0 };
    const grid = drawSky(frame);
    const lowerStart = Math.round(frame.height * 0.75) * frame.width;
    expect(grid.cells.slice(lowerStart).every((cell) => cell === Tone.clear)).toBe(true);
  });

  it("places markers in the same spots on every frame", () => {
    const first = drawSky({ width: 300, height: 200, tick: 1 });
    const second = drawSky({ width: 300, height: 200, tick: 2 });
    const differing = first.cells.reduce(
      (total, cell, index) => (cell === second.cells[index] ? total : total + 1),
      0,
    );
    // Only twinkling arms may differ between two consecutive frames.
    expect(differing).toBeLessThan(40);
  });
});

describe("wind on the maize", () => {
  const ticks = Array.from({ length: 120 }, (_, tick) => tick);

  it("is a pure function of the tick and the plant, and never moves more than one pixel", () => {
    expect(windSway(17, 2)).toBe(windSway(17, 2));
    ticks.forEach((tick) => {
      [0, 1, 2, 3].forEach((plant) => {
        expect(Math.abs(windSway(tick, plant))).toBeLessThanOrEqual(1);
      });
    });
  });

  it("pushes both ways and lets the plants rest in between", () => {
    const values = new Set(ticks.map((tick) => windSway(tick, 0)));
    expect(values.has(-1)).toBe(true);
    expect(values.has(0)).toBe(true);
    expect(values.has(1)).toBe(true);
  });

  it("does not move every plant at once", () => {
    expect(ticks.some((tick) => windSway(tick, 0) !== windSway(tick, 1))).toBe(true);
  });

  it("moves the maize of the hero field without changing how much of it there is by much", () => {
    const frames = ticks.slice(0, 40).map((tick) => drawHeroField({ ...DESKTOP, tick }));
    const leftEdge = (grid: PixelGrid) =>
      Array.from({ length: DESKTOP.height }, (_, y) =>
        Array.from(grid.cells.slice(y * DESKTOP.width, y * DESKTOP.width + FIELD_LEFT)).join(""),
      ).join("|");
    expect(new Set(frames.map(leftEdge)).size).toBeGreaterThan(1);
  });
});
