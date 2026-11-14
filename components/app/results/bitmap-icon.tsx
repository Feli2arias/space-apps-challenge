// Contract: BitmapIcon
// Props: bitmap (readonly string[], required) — rows of text, "." is empty, anything else filled
//        className (string, optional) — sets the size (for example "size-5") and colour
// Variants: one per bitmap in RESULT_ICONS (icons used only by the results panel)
// States: static; it inherits colour from its parent
// Accessibility: decorative, aria-hidden. The text next to it carries the meaning.
// Responsive: scales with the size classes passed in; edges stay crisp at any size

import { bitmapSize, bitmapToPath } from "@/components/pixel/grid";
import { cn } from "@/lib/cn";

/** Icons the results panel needs beyond the shared set in components/ui/pixel-icons. */
export const RESULT_ICONS = {
  soil: [
    "............",
    "XXXXXXXXXXXX",
    "XXXXXXXXXXXX",
    "............",
    "X.X.X.X.X.X.",
    ".X.X.X.X.X.X",
    "X.X.X.X.X.X.",
    "............",
    "XX..XX..XX..",
    "............",
    "..XX..XX..XX",
    "............",
  ],
  climate: [
    ".....XX.....",
    "....X..X....",
    "....X..X..XX",
    "....X..X....",
    "....XXXX..XX",
    "....XXXX....",
    "....XXXX..XX",
    "...XXXXXX...",
    "..XXXXXXXX..",
    "..XXXXXXXX..",
    "...XXXXXX...",
    "....XXXX....",
  ],
  /** A filled plot inside its boundary: numbers computed inside the area. */
  scopeParcel: [
    "XXXXXXXX",
    "X......X",
    "X.XXXX.X",
    "X.XXXX.X",
    "X.XXXX.X",
    "X.XXXX.X",
    "X......X",
    "XXXXXXXX",
  ],
  /** One pixel under a crosshair: the value at the chosen point. */
  scopePixel: [
    "...XX...",
    "...XX...",
    "........",
    "XX.XX.XX",
    "XX.XX.XX",
    "........",
    "...XX...",
    "...XX...",
  ],
  /** A small plot lost inside a wide dashed cell: the value of the surroundings. */
  scopeRegional: [
    "XX.XX.XX",
    "X......X",
    "........",
    "X..XX..X",
    "X..XX..X",
    "........",
    "X......X",
    "XX.XX.XX",
  ],
  /** A question-like gap: the source did not state its scope. */
  scopeUnknown: [
    "X.X.X.X.",
    ".......X",
    "X.......",
    ".......X",
    "X.......",
    ".......X",
    "X.......",
    ".X.X.X.X",
  ],
} as const satisfies Record<string, readonly string[]>;

export type ResultIconName = keyof typeof RESULT_ICONS;

interface BitmapIconProps {
  readonly bitmap: readonly string[];
  readonly className?: string;
}

export function BitmapIcon({ bitmap, className }: BitmapIconProps) {
  const { width, height } = bitmapSize(bitmap);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      shapeRendering="crispEdges"
      fill="currentColor"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <path d={bitmapToPath(bitmap)} />
    </svg>
  );
}
