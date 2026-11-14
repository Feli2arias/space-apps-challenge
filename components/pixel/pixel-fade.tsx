// Contract: PixelFade
// Props: rows (number, optional, default 12) — dither rows; cell (number, optional, default 4)
//        — CSS pixels per art pixel, matching the canvas scenes; className (string, optional)
// Variants: tone "ink" (default) | "white" — the colour of the section whose edge dissolves
// States: static
// Accessibility: purely decorative, aria-hidden
// Responsive: spans its positioned parent; fixed height of rows × cell, placed just below the
//             parent's bottom edge so it overlaps the next section's top padding (no layout shift)

import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { DITHER_TILE_COLUMNS, ditherFadeMask } from "./dither-mask";

const DEFAULT_ROWS = 12;
const DEFAULT_CELL = 4;

type PixelFadeTone = "ink" | "white";

const TONE_CLASSES: Readonly<Record<PixelFadeTone, string>> = {
  ink: "bg-ink",
  white: "bg-white",
};

interface PixelFadeProps {
  readonly tone?: PixelFadeTone;
  readonly rows?: number;
  readonly cell?: number;
  readonly className?: string;
}

/** Dissolves the bottom edge of a band into the section below it, pixel by pixel. */
export function PixelFade({
  tone = "ink",
  rows = DEFAULT_ROWS,
  cell = DEFAULT_CELL,
  className,
}: PixelFadeProps) {
  const mask = ditherFadeMask(rows);
  const size = `${DITHER_TILE_COLUMNS * cell}px ${rows * cell}px`;
  const style: CSSProperties = {
    height: rows * cell,
    maskImage: mask,
    maskSize: size,
    maskRepeat: "repeat-x",
    WebkitMaskImage: mask,
    WebkitMaskSize: size,
    WebkitMaskRepeat: "repeat-x",
  };

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-x-0 top-full", TONE_CLASSES[tone], className)}
      style={style}
    />
  );
}
