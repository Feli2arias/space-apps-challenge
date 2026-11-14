"use client";

// Contract: PixelCanvas
// Props: scene (SceneName, required) — which pixel-art scene to draw
//        cell (number, optional, default 4) — CSS pixels per art pixel
//        className (string, optional)
// Variants: one per scene ("sky" | "hero-field" | "closing-field")
// States: animating (visible, motion allowed, after a short start delay) | still (off-screen,
//         reduced motion or before the delay) | empty (zero size, draws nothing)
// Accessibility: purely decorative, aria-hidden; no information lives only in the canvas.
//                Honors prefers-reduced-motion by drawing a single still frame.
// Responsive: fills its container at every breakpoint; the art resolution follows the container size.

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { parseHex, type Rgb } from "./color";
import { drawClosingField, drawHeroField } from "./field-scene";
import { Tone, type Frame, type PixelGrid } from "./grid";
import { drawSky } from "./sky-scene";

interface Scene {
  readonly draw: (frame: Frame) => PixelGrid;
  /** Milliseconds between frames. Slow scenes repaint less often. */
  readonly interval: number;
}

const SCENES = {
  sky: { draw: drawSky, interval: 450 },
  "hero-field": { draw: drawHeroField, interval: 150 },
  "closing-field": { draw: drawClosingField, interval: 450 },
} as const satisfies Record<string, Scene>;

export type SceneName = keyof typeof SCENES;

/** Colour token behind each palette slot; index matches `Tone`. */
const TONE_TOKENS: Readonly<Record<number, string>> = {
  [Tone.paper]: "--color-paper",
  [Tone.mist]: "--color-mist",
  [Tone.stone]: "--color-stone",
  [Tone.cinnabar]: "--color-cinnabar",
  [Tone.cinnabarDeep]: "--color-cinnabar-deep",
  [Tone.ink]: "--color-ink",
  [Tone.white]: "--color-white",
};

/** The first frame is painted at once; the loop waits so it never competes with page load. */
const ANIMATION_START_DELAY_MS = 1500;
const DEFAULT_CELL = 4;
const TONE_COUNT = Object.keys(Tone).length;

/** Reads the palette from the design tokens so the canvas never hardcodes a colour. */
function readPalette(): ReadonlyArray<Rgb | null> {
  const styles = getComputedStyle(document.documentElement);
  return Array.from({ length: TONE_COUNT }, (_, index) => {
    const token = TONE_TOKENS[index];
    return token ? parseHex(styles.getPropertyValue(token)) : null;
  });
}

function toImageData(grid: PixelGrid, palette: ReadonlyArray<Rgb | null>): ImageData {
  const image = new ImageData(grid.width, grid.height);
  for (let index = 0; index < grid.cells.length; index += 1) {
    const color = palette[grid.cells[index]];
    if (!color) continue;
    const offset = index * 4;
    image.data[offset] = color[0];
    image.data[offset + 1] = color[1];
    image.data[offset + 2] = color[2];
    image.data[offset + 3] = 255;
  }
  return image;
}

interface PixelCanvasProps {
  readonly scene: SceneName;
  readonly cell?: number;
  readonly className?: string;
}

export function PixelCanvas({ scene, cell = DEFAULT_CELL, className }: PixelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const { draw, interval } = SCENES[scene];
    const palette = readPalette();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let columns = 0;
    let rows = 0;
    let tick = 0;
    let visible = false;
    let ready = false;
    let frameRequest = 0;
    let lastPaint = 0;

    const paint = () => {
      if (columns === 0 || rows === 0) return;
      const grid = draw({ width: columns, height: rows, tick });
      context.putImageData(toImageData(grid, palette), 0, 0);
    };

    const loop = (time: number) => {
      if (time - lastPaint >= interval) {
        lastPaint = time;
        tick += 1;
        paint();
      }
      frameRequest = requestAnimationFrame(loop);
    };

    const syncAnimation = () => {
      cancelAnimationFrame(frameRequest);
      frameRequest = 0;
      if (ready && visible && !reducedMotion.matches) {
        frameRequest = requestAnimationFrame(loop);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      const bounds = canvas.getBoundingClientRect();
      columns = Math.ceil(bounds.width / cell);
      rows = Math.ceil(bounds.height / cell);
      canvas.width = columns;
      canvas.height = rows;
      paint();
    });
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      syncAnimation();
    });
    intersectionObserver.observe(canvas);

    reducedMotion.addEventListener("change", syncAnimation);

    const startTimer = window.setTimeout(() => {
      ready = true;
      syncAnimation();
    }, ANIMATION_START_DELAY_MS);

    return () => {
      window.clearTimeout(startTimer);
      cancelAnimationFrame(frameRequest);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      reducedMotion.removeEventListener("change", syncAnimation);
    };
  }, [scene, cell]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("pixelated block size-full", className)}
    />
  );
}
