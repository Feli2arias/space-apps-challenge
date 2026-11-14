// Contract: ResultsPanel
// Props: analysis (Analysis, required) — the result as the API returned it; every figure in
//          the panel comes from this object and nothing else
//        locale (Locale, required) — language of every word and number format
//        onRetry ((source: SourceId) => void, required) — asks the backend to query one
//          source again
//        retrying (readonly SourceId[], required) — sources being queried again right now
//        reading, advice (ReactNode, optional) — the AI reading (first) and recommendations
//          (after the data cards)
//        rotations (ReactNode, optional) — the closed "Rotaciones" section at the end
//        titleId, headingRef, plotActions (optional) — for the "Terreno escaneado" box
// Variants: none
// States: complete | partial | failed, and per source ok | no-data | error | retrying.
//         The words for metrics, limitations, quality notes and conversions come from
//         SOURCE_MESSAGES; a code with no text falls back to the raw code, so an unknown
//         metric or code never breaks the panel. See ResultsPanelView for the full list.
// Accessibility: a labelled region whose headings start at h2; see ResultsPanelView
// Responsive: fills whatever contains it (the whole screen, or beside the map), from 320px up
"use client";

import { SOURCE_MESSAGES } from "@/lib/analysis/sources/messages";
import type { ReactNode, Ref } from "react";
import type { Analysis, SourceId } from "@/lib/analysis/types";
import type { Locale } from "@/lib/site";
import { ResultsPanelView } from "./results/results-panel-view";

export interface ResultsPanelProps {
  readonly analysis: Analysis;
  readonly locale: Locale;
  /** Asks the backend to query one source again. */
  readonly onRetry: (source: SourceId) => void;
  /** Sources being queried again right now. */
  readonly retrying: readonly SourceId[];
  readonly reading?: ReactNode;
  readonly advice?: ReactNode;
  readonly rotations?: ReactNode;
  readonly titleId?: string;
  readonly headingRef?: Ref<HTMLHeadingElement>;
  readonly plotActions?: ReactNode;
}

export function ResultsPanel(props: ResultsPanelProps) {
  return (
    <ResultsPanelView {...props} catalogue={SOURCE_MESSAGES} />
  );
}
