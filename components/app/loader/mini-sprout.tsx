// Contract: MiniSprout
// Props: className (string, optional) — size and spacing from the parent (defaults to 56 px)
// Variants: none
// States: animating (seed → sprout → leaves → flower, one small drawing at a time, then
//         again from the seed) | still (reduced motion: the grown flower only).
//         It has no "finished" state: the loop restarts for as long as it is mounted.
// Accessibility: decorative, aria-hidden; the message beside it carries the meaning
// Responsive: a small fixed drawing with crisp pixel edges at any size

import { cn } from "@/lib/cn";
import "./mini-sprout.css";

interface MiniSproutProps {
  readonly className?: string;
}

/** The drawing is 13 pixels wide and 14 tall; the stem grows on the middle column. */
const WIDTH = 13;
const HEIGHT = 14;

/** Soil line shared by every step. */
const GROUND = "M2 12h9v1h-9z";

/** Each step as pixel rectangles: `ink` for the plant, `accent` for the flower. */
const FRAMES = [
  { name: "seed", ink: "M5 10h3v2h-3z", accent: "" },
  { name: "sprout", ink: "M6 8h1v4h-1zM7 7h2v1h-2z", accent: "" },
  {
    name: "leaves",
    ink: "M6 5h1v7h-1zM4 8h2v1h-2zM3 7h2v1h-2zM7 7h2v1h-2zM8 6h2v1h-2z",
    accent: "",
  },
  {
    name: "flower",
    ink: "M6 4h1v8h-1zM4 9h2v1h-2zM3 8h2v1h-2zM7 8h2v1h-2zM8 7h2v1h-2z",
    accent: "M6 0h1v1h-1zM5 1h3v1h-3zM4 2h2v1h-2zM7 2h2v1h-2zM5 3h3v1h-3z",
  },
] as const;

export function MiniSprout({ className }: MiniSproutProps) {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={cn("h-14 w-13", className)}
    >
      <path d={GROUND} className="fill-ink" />
      {FRAMES.map((frame) => (
        <g key={frame.name} className={`mini-sprout__frame mini-sprout__frame--${frame.name}`}>
          <path d={frame.ink} className="fill-ink" />
          {frame.accent ? <path d={frame.accent} className="fill-cinnabar" /> : null}
        </g>
      ))}
    </svg>
  );
}
