// Contract: PixelLink
// Props: href (string, required) — in-page anchor or URL
//        children (ReactNode, required) — the label
//        variant ("accent" | "outline" | "ink", optional, default "accent")
//        size ("md" | "sm", optional, default "md")
//        withArrow (boolean, optional, default false) — pixel arrow after the label
//        className (string, optional)
// Variants: accent = cinnabar fill with hard ink shadow; outline = white with ink border;
//           ink = ink fill, for use on cinnabar backgrounds
// States: default | hover (lifts 2px up-left in two steps) | focus-visible (2px outline)
//         | active (presses 2px down-right, shadow collapses). It is a link, so there is
//         no disabled, loading, error or empty state.
// Accessibility: renders an anchor; 44px minimum touch height; ink on cinnabar is 6.3:1,
//                ink on white 17:1, white on ink 17:1
// Responsive: intrinsic width at every breakpoint; the label never wraps

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { PixelIcon } from "./pixel-icon";

type PixelLinkVariant = "accent" | "outline" | "ink";
type PixelLinkSize = "md" | "sm";

interface PixelLinkProps {
  readonly href: string;
  readonly children: ReactNode;
  readonly variant?: PixelLinkVariant;
  readonly size?: PixelLinkSize;
  readonly withArrow?: boolean;
  readonly className?: string;
}

const VARIANT_CLASSES: Readonly<Record<PixelLinkVariant, string>> = {
  accent:
    "border-cinnabar bg-cinnabar text-ink shadow-pixel-sm active:shadow-none",
  outline: "border-ink bg-white text-ink hover:bg-ink hover:text-white",
  ink: "border-ink bg-ink text-white hover:bg-white hover:text-ink",
};

const SIZE_CLASSES: Readonly<Record<PixelLinkSize, string>> = {
  md: "px-5",
  sm: "px-3.5",
};

export function PixelLink({
  href,
  children,
  variant = "accent",
  size = "md",
  withArrow = false,
  className,
}: PixelLinkProps) {
  return (
    <a
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center gap-2.5 border font-mono text-small font-semibold tracking-label whitespace-nowrap uppercase",
        "transition-[translate,background-color,color,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5",
        "active:translate-x-0.5 active:translate-y-0.5 motion-reduce:transition-none",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
    >
      {children}
      {withArrow ? <PixelIcon name="arrow" className="h-2.5 w-3" /> : null}
    </a>
  );
}
