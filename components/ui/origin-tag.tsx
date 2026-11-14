// Contract: OriginTag
// Props: origin (Origin, required) — where the figure comes from
//        label (string, required) — translated name of that origin
//        className (string, optional) — sets the colour for the background it sits on
// Variants: observed (solid block) | modeled (checker) | declared (outline) | study (lines)
// States: static label only
// Accessibility: the glyph is decorative; the origin is always written out as text,
//                so it never depends on shape or colour alone
// Responsive: inline, wraps with the surrounding text

import type { Origin } from "@/lib/i18n/types";
import { cn } from "@/lib/cn";
import { PixelIcon } from "./pixel-icon";

interface OriginTagProps {
  readonly origin: Origin;
  readonly label: string;
  readonly className?: string;
}

export function OriginTag({ origin, label, className }: OriginTagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-label tracking-label uppercase",
        className,
      )}
    >
      <PixelIcon name={origin} className="size-3" />
      {label}
    </span>
  );
}
