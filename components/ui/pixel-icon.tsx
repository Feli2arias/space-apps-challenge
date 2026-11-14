// Contract: PixelIcon
// Props: name (PixelIconName, required) — which bitmap to draw
//        className (string, optional) — sets the size (for example "size-6") and colour
// Variants: one per bitmap in PIXEL_ICONS
// States: static only; it inherits colour from its parent, including hover and focus
// Accessibility: decorative, aria-hidden. The text next to it carries the meaning.
// Responsive: scales with the size classes passed in; edges stay crisp at any size

import { bitmapSize, bitmapToPath } from "@/components/pixel/grid";
import { cn } from "@/lib/cn";
import { PIXEL_ICONS, type PixelIconName } from "./pixel-icons";

interface PixelIconProps {
  readonly name: PixelIconName;
  readonly className?: string;
}

export function PixelIcon({ name, className }: PixelIconProps) {
  const bitmap = PIXEL_ICONS[name];
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
