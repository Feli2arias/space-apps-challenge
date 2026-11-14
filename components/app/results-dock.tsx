"use client";

// Contract: ResultsDock
// Props: dict (WorkspaceDictionary["results"], required) — translated text
//        stale (boolean, required) — the selection changed after these results
//        onAnalyseNew (() => void, required) — analyse the current selection instead
//        retryFailure (string | null, required) — sentence shown when querying a source
//          again failed; the results stay
//        onDismissRetryFailure (() => void, required)
//        className (string, optional) — placement in the workspace grid
//        children (ReactNode, required) — the ResultsPanel (its "Terreno escaneado" box holds
//          the heading and the actions)
// Variants: none — the same full-height area on every screen; the workspace gives it the
//           whole width, or the part beside the map when the map is open
// States: stale notice | retry-failed notice | neither. Loading and errors of a whole
//         analysis are shown over the map, not here.
// Accessibility: a complementary landmark named by the results heading (the panel's h2,
//                passed as `labelledBy`). Notices are role="status" (stale) and role="alert"
//                (retry failed). The entrance animation is stepped and skipped under
//                prefers-reduced-motion.
// Responsive: fills its grid cell or the rest of the phone screen; the panel inside scrolls

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { WorkspaceDictionary } from "@/lib/i18n/app/workspace";
import { PixelButton } from "./pixel-button";
import "./workspace.css";

interface ResultsDockProps {
  readonly dict: WorkspaceDictionary["results"];
  readonly labelledBy: string;
  readonly stale: boolean;
  readonly onAnalyseNew: () => void;
  readonly retryFailure: string | null;
  readonly onDismissRetryFailure: () => void;
  readonly className?: string;
  readonly children: ReactNode;
}

export function ResultsDock({
  dict,
  labelledBy,
  stale,
  onAnalyseNew,
  retryFailure,
  onDismissRetryFailure,
  className,
  children,
}: ResultsDockProps) {
  return (
    <aside aria-labelledby={labelledBy} className={cn("bts-panel-enter flex min-h-0 flex-col bg-paper", className)}>
      {stale ? (
        <div role="status" className="shrink-0 border-b border-ink bg-mist px-4 py-3 lg:px-6">
          <p className="text-small font-medium">{dict.stale}</p>
          <PixelButton size="sm" variant="accent" withArrow onClick={onAnalyseNew} className="mt-2">
            {dict.analyseNew}
          </PixelButton>
        </div>
      ) : null}

      {retryFailure ? (
        <div role="alert" className="flex shrink-0 items-start justify-between gap-3 border-b border-ink px-4 py-2 lg:px-6">
          <p className="py-2 text-small font-medium text-cinnabar-deep">{retryFailure}</p>
          <button
            type="button"
            onClick={onDismissRetryFailure}
            className="min-h-11 shrink-0 cursor-pointer px-2 font-mono text-label tracking-label uppercase underline"
          >
            {dict.dismiss}
          </button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1">{children}</div>
    </aside>
  );
}
