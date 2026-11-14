import { describe, expect, it } from "vitest";
import { drawClosingField, drawHeroField } from "./field-scene";
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
    expect(row.every((cell) => cell !== Tone.clear)).toBe(true);
    expect(row.filter((cell) => cell === Tone.ink).length).toBeGreaterThan(row.length / 2);
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

describe("drawClosingField", () => {
  it("shows seedlings along the furrows", () => {
    expect(count(drawClosingField(DESKTOP), Tone.white)).toBeGreaterThan(20);
  });

  it("stays still between ticks, since it has no parcel, sun or satellite", () => {
    const later: Frame = { ...DESKTOP, tick: 5 };
    expect(drawClosingField(later).cells).toEqual(drawClosingField(DESKTOP).cells);
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
