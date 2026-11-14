// Contract: PixelBars
// Props: bars (readonly Bar[], required) — label, numeric value, written value and tone
// Variants: each bar is "accent" (cinnabar) or "ink" (the reference row)
// States: default | empty (no bars: renders nothing). Static, no hover or loading.
// Accessibility: a plain list; every bar's value is written as text beside it, so the
//                chart never relies on bar length or colour alone
// Responsive: label sits above its bar on small screens and beside it from sm (640px) up

import type { Bar, BarTone } from "@/lib/i18n/types";
import { cn } from "@/lib/cn";

interface PixelBarsProps {
  readonly bars: readonly Bar[];
}

const FILL_CLASSES: Readonly<Record<BarTone, string>> = {
  accent: "bg-cinnabar",
  ink: "bg-ink",
};

export function PixelBars({ bars }: PixelBarsProps) {
  if (bars.length === 0) return null;
  const largest = Math.max(...bars.map((bar) => bar.value));

  return (
    <ul className="flex flex-col gap-3.5">
      {bars.map((bar) => (
        <li
          key={bar.label}
          className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[9.5rem_1fr_3.25rem]"
        >
          <span className="col-span-2 text-small sm:col-span-1">{bar.label}</span>
          <span className="relative block h-4 bg-mist">
            <span
              className={cn("block h-full", FILL_CLASSES[bar.tone])}
              style={{ width: `${(bar.value / largest) * 100}%` }}
            />
            <span className="pixel-ticks absolute inset-0" aria-hidden="true" />
          </span>
          <span className="text-right font-display text-h3 tabular-nums">
            {bar.display}
          </span>
        </li>
      ))}
    </ul>
  );
}
