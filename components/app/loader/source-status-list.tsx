// Contract: SourceStatusList
// Props: sources (readonly LoaderSource[], required) — label, real state and optional detail
//        stateLabels (Record<LoaderSourceState, string>, required) — the four state words
//        label (string, required) — accessible name of the list
// Variants: one row look per state — waiting (hollow square, muted), running (blinking
//           seed, cinnabar), done (check, ink), failed (cross, cinnabar)
// States: default | empty (no sources: renders nothing)
// Accessibility: a labelled list; every state is written as a word next to its icon, so it
//                never depends on shape, colour or movement. It is not a live region: the
//                loader announces its message, not every row change.
// Responsive: label and state share a row and wrap on narrow screens; from 320px up

import { PixelIcon } from "@/components/ui/pixel-icon";
import type { PixelIconName } from "@/components/ui/pixel-icons";
import { cn } from "@/lib/cn";
import type { LoaderSource, LoaderSourceState } from "../seed-loader";
import "../busy.css";

interface SourceStatusListProps {
  readonly sources: readonly LoaderSource[];
  readonly stateLabels: Readonly<Record<LoaderSourceState, string>>;
  readonly label: string;
}

const STATE_ICONS: Readonly<Record<LoaderSourceState, PixelIconName>> = {
  waiting: "declared",
  running: "seed",
  done: "check",
  failed: "cross",
};

const STATE_CLASSES: Readonly<Record<LoaderSourceState, string>> = {
  waiting: "text-muted",
  running: "text-cinnabar-deep",
  done: "text-ink",
  failed: "text-cinnabar-deep",
};

export function SourceStatusList({ sources, stateLabels, label }: SourceStatusListProps) {
  if (sources.length === 0) return null;

  return (
    <ul aria-label={label} className="w-full border border-ink bg-white text-left shadow-pixel-sm">
      {sources.map((source) => (
        <li
          key={source.id}
          data-state={source.state}
          className="border-b border-line px-4 py-3 last:border-b-0"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span className={cn("text-body", source.state === "waiting" && "text-muted")}>
              {source.label}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-2 font-mono text-label tracking-label uppercase",
                STATE_CLASSES[source.state],
              )}
            >
              <PixelIcon
                name={STATE_ICONS[source.state]}
                className={cn("size-3", source.state === "running" && "app-busy-blink")}
              />
              {stateLabels[source.state]}
            </span>
          </div>
          {source.detail ? <p className="mt-1 text-small text-muted">{source.detail}</p> : null}
        </li>
      ))}
    </ul>
  );
}
