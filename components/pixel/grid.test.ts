import { describe, expect, it } from "vitest";
import {
  bitmapSize,
  bitmapToPath,
  clamp,
  createGrid,
  createRandom,
  dither,
  drawLine,
  fillRect,
  plot,
  stamp,
  Tone,
  toneAt,
} from "./grid";

describe("createGrid", () => {
  it("creates an empty grid of the requested size", () => {
    const grid = createGrid(4, 3);
    expect(grid.width).toBe(4);
    expect(grid.height).toBe(3);
    expect(Array.from(grid.cells)).toEqual(new Array(12).fill(Tone.clear));
  });

  it("treats negative or fractional sizes as safe whole numbers", () => {
    expect(createGrid(-5, 3).cells).toHaveLength(0);
    expect(createGrid(2.9, 2.2).cells).toHaveLength(4);
  });
});

describe("plot", () => {
  it("sets a pixel inside the grid", () => {
    const grid = createGrid(3, 3);
    plot(grid, 1, 2, Tone.ink);
    expect(toneAt(grid, 1, 2)).toBe(Tone.ink);
  });

  it("ignores coordinates outside the grid instead of wrapping", () => {
    const grid = createGrid(3, 3);
    plot(grid, 3, 0, Tone.ink);
    plot(grid, -1, 1, Tone.ink);
    plot(grid, 0, 9, Tone.ink);
    expect(Array.from(grid.cells).every((cell) => cell === Tone.clear)).toBe(true);
  });

  it("reads out-of-range pixels as clear", () => {
    expect(toneAt(createGrid(2, 2), 5, 5)).toBe(Tone.clear);
  });
});

describe("fillRect", () => {
  it("fills only the requested area", () => {
    const grid = createGrid(4, 4);
    fillRect(grid, 1, 1, 2, 2, Tone.cinnabar);
    const filled = Array.from(grid.cells).filter((cell) => cell === Tone.cinnabar);
    expect(filled).toHaveLength(4);
    expect(toneAt(grid, 0, 0)).toBe(Tone.clear);
    expect(toneAt(grid, 2, 2)).toBe(Tone.cinnabar);
  });
});

describe("drawLine", () => {
  it("draws a connected diagonal including both ends", () => {
    const grid = createGrid(4, 4);
    drawLine(grid, 0, 0, 3, 3, () => Tone.ink);
    expect([0, 1, 2, 3].map((i) => toneAt(grid, i, i))).toEqual(new Array(4).fill(Tone.ink));
  });

  it("leaves gaps where the picker returns null", () => {
    const grid = createGrid(6, 1);
    drawLine(grid, 0, 0, 5, 0, (step) => (step % 2 === 0 ? Tone.ink : null));
    expect(Array.from(grid.cells)).toEqual([
      Tone.ink,
      Tone.clear,
      Tone.ink,
      Tone.clear,
      Tone.ink,
      Tone.clear,
    ]);
  });

  it("draws a single pixel when both ends coincide", () => {
    const grid = createGrid(2, 2);
    drawLine(grid, 1, 1, 1, 1, () => Tone.ink);
    expect(Array.from(grid.cells).filter((cell) => cell === Tone.ink)).toHaveLength(1);
  });
});

describe("stamp", () => {
  it("copies mapped characters and skips the rest", () => {
    const grid = createGrid(3, 2);
    stamp(grid, ["A.B", ".A."], 0, 0, { A: Tone.ink, B: Tone.cinnabar });
    expect(Array.from(grid.cells)).toEqual([
      Tone.ink,
      Tone.clear,
      Tone.cinnabar,
      Tone.clear,
      Tone.ink,
      Tone.clear,
    ]);
  });
});

describe("dither", () => {
  it("is empty at level 0 and full at level 1", () => {
    const cells = Array.from({ length: 16 }, (_, index) => [index % 4, Math.floor(index / 4)]);
    expect(cells.some(([x, y]) => dither(x, y, 0))).toBe(false);
    expect(cells.every(([x, y]) => dither(x, y, 1))).toBe(true);
  });

  it("covers about half of the pixels at level 0.5", () => {
    let on = 0;
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        if (dither(x, y, 0.5)) on += 1;
      }
    }
    expect(on).toBe(32);
  });
});

describe("createRandom", () => {
  it("repeats the same sequence for the same seed", () => {
    const first = createRandom(42);
    const second = createRandom(42);
    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });

  it("stays within 0 (inclusive) and 1 (exclusive)", () => {
    const random = createRandom(7);
    const values = Array.from({ length: 200 }, () => random());
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
  });
});

describe("clamp", () => {
  it("limits a value to the given range", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-2, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});

describe("bitmapToPath", () => {
  it("merges horizontal runs into single rectangles", () => {
    expect(bitmapToPath(["XX.X"])).toBe("M0 0h2v1h-2zM3 0h1v1h-1z");
  });

  it("returns an empty path for an empty bitmap", () => {
    expect(bitmapToPath(["...", "..."])).toBe("");
  });
});

describe("bitmapSize", () => {
  it("uses the widest row", () => {
    expect(bitmapSize(["X", "XXX", "XX"])).toEqual({ width: 3, height: 3 });
  });
});
