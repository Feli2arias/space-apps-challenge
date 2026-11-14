// Contract: OutlineTools
// Props: dict (WorkspaceDictionary["form"]["outline"], required) — translated text
//        locale (Locale, required) — language for the area figure
//        draft (SelectionDraft, required) — the corners marked so far and whether the
//          outline is finished
//        error (string | null, required) — what is wrong with the outline, when something is
//        onAction ((action: DraftAction) => void, required) — undo, finish or clear
//        ref (Ref<HTMLDivElement>, optional) — the form focuses it to point at an error
// Variants: none
// States: empty (no corners: undo, finish and clear are unavailable) | drawing (count of
//         corners, area from 3 corners on) | finished (says so; undo reopens it) | invalid
//         (message under the tools). The corners themselves are drawn by the map; how to
//         draw them is the area hint of the form, above these tools.
// Accessibility: a labelled group that can take focus; the corner count and the live
//                area are in a polite live region; unavailable buttons keep their place in
//                the tab order with aria-disabled; the error is announced with role="alert".
//                It always states that the outline is not a verified property boundary.
// Responsive: one status line, then the three buttons on one row (they wrap if the labels
//             do not fit), then the one-line disclaimer

import type { Ref } from "react";
import { formatNumber } from "@/lib/analysis/format";
import {
  canFinishOutline,
  outlineAreaHectares,
  type DraftAction,
  type SelectionDraft,
} from "@/lib/analysis/selection";
import { ANALYSIS_LIMITS } from "@/lib/analysis/types";
import { fill } from "@/lib/i18n/app/results";
import type { WorkspaceDictionary } from "@/lib/i18n/app/workspace";
import type { Locale } from "@/lib/site";
import { FieldError } from "./form-controls";
import { PixelButton } from "./pixel-button";

interface OutlineToolsProps {
  readonly dict: WorkspaceDictionary["form"]["outline"];
  readonly locale: Locale;
  readonly draft: SelectionDraft;
  readonly error: string | null;
  readonly onAction: (action: DraftAction) => void;
  readonly ref?: Ref<HTMLDivElement>;
}

/** Decimals for an area in hectares: 0.01 ha is 100 m², about one Sentinel-2 pixel. */
const AREA_DECIMALS = 2;

export function OutlineTools({ dict, locale, draft, error, onAction, ref }: OutlineToolsProps) {
  const corners = draft.vertices.length;
  const area = outlineAreaHectares(draft.vertices);
  const hasCorners = corners > 0;

  return (
    <div
      ref={ref}
      role="group"
      aria-label={dict.toolsLabel}
      tabIndex={-1}
      className="mt-2"
    >
      <p role="status" className="font-mono text-label">
        {fill(dict.corners, { count: corners, max: ANALYSIS_LIMITS.maxPolygonVertices })}
        {" · "}
        <span className="font-semibold">
          {area === null
            ? dict.areaPending
            : fill(dict.area, { area: formatNumber(area, locale, AREA_DECIMALS) ?? "" })}
        </span>
        {draft.outlineFinished ? <span className="block">{dict.finished}</span> : null}
      </p>

      <div className="mt-1.5 grid grid-cols-3">
        <PixelButton
          size="sm"
          unavailable={!hasCorners}
          onClick={() => onAction({ type: "outline-undone" })}
          className="min-w-0"
        >
          {dict.undo}
        </PixelButton>
        <PixelButton
          size="sm"
          variant="ink"
          unavailable={!canFinishOutline(draft)}
          onClick={() => onAction({ type: "outline-finished" })}
          className="-ml-px min-w-0"
        >
          {dict.finish}
        </PixelButton>
        <PixelButton
          size="sm"
          unavailable={!hasCorners}
          onClick={() => onAction({ type: "outline-cleared" })}
          className="-ml-px min-w-0"
        >
          {dict.clear}
        </PixelButton>
      </div>

      {error ? (
        <FieldError announce className="mt-1.5">
          {error}
        </FieldError>
      ) : null}

      <p className="mt-1.5 text-label text-muted">{dict.disclaimer}</p>
    </div>
  );
}
