// Contract: analysis overlays (LoadingOverlay, FailureOverlay)
// Props: LoadingOverlay — label (string) names the region; cancelLabel (string);
//          onCancel (() => void); children (ReactNode) — the SeedLoader
//        FailureOverlay — dict (WorkspaceDictionary["failure"]); failure (AnalysisFailure) —
//          how the request ended; onRetry (() => void); onDismiss (() => void);
//          ref (Ref<HTMLDivElement>, optional) — the caller focuses it when it appears
// Variants: none
// States: LoadingOverlay is the loading state of the screen. FailureOverlay is its error
//         state: one plain sentence chosen by what failed (no connection, too many
//         requests with the wait when the server gives one, area refused, answer cut
//         off, server problem), the server's own remarks as a folded technical detail,
//         and the two ways out: try again or close.
// Accessibility: both cover the map area only, so the form stays reachable. The failure
//                box is role="alert" and can take focus, so it is announced and the retry
//                button is the next stop; buttons are at least 44px.
// Responsive: centred in the map area at every width; content scrolls if the area is short

import type { ReactNode, Ref } from "react";
import type { AnalysisFailure } from "@/lib/analysis/client";
import { fill } from "@/lib/i18n/app/results";
import type { WorkspaceDictionary } from "@/lib/i18n/app/workspace";
import { PixelButton } from "./pixel-button";

const OVERLAY_CLASSES =
  "absolute inset-0 z-20 flex flex-col items-center gap-6 overflow-y-auto bg-paper/95 p-6";

type FailureWords = WorkspaceDictionary["failure"];

interface LoadingOverlayProps {
  readonly label: string;
  readonly cancelLabel: string;
  readonly onCancel: () => void;
  readonly children: ReactNode;
}

export function LoadingOverlay({ label, cancelLabel, onCancel, children }: LoadingOverlayProps) {
  return (
    <div role="group" aria-label={label} className={OVERLAY_CLASSES}>
      {/* Auto margins centre the content and still let it scroll from the top when it is tall. */}
      <div className="my-auto flex w-full flex-col items-center gap-6">
        {children}
        <PixelButton size="sm" onClick={onCancel}>
          {cancelLabel}
        </PixelButton>
      </div>
    </div>
  );
}

/** HTTP status the backend uses for "too many requests". */
const TOO_MANY_REQUESTS = 429;

/** The plain sentence for one way an analysis can fail. */
export function failureText(failure: AnalysisFailure, dict: FailureWords): string {
  switch (failure.kind) {
    case "network":
      return dict.network;
    case "incomplete":
      return dict.incomplete;
    case "bad-response":
    case "fatal":
      return dict.server;
    case "rejected": {
      const code = failure.error?.code;
      if (code === "rate-limited" || failure.status === TOO_MANY_REQUESTS) {
        return failure.retryAfterSeconds === null
          ? dict.rateLimited
          : fill(dict.rateLimitedWait, { seconds: failure.retryAfterSeconds });
      }
      return code === "invalid-request" ? dict.invalidRequest : dict.server;
    }
  }
}

/** What the server itself said, for the folded technical detail. Empty when it said nothing. */
function technicalDetail(failure: AnalysisFailure): readonly string[] {
  if (failure.kind !== "rejected" && failure.kind !== "fatal") return [];
  const error = failure.error;
  if (!error) return failure.kind === "rejected" ? [`HTTP ${failure.status}`] : [];
  const issues = (error.issues ?? []).map((issue) => `${issue.path}: ${issue.message}`);
  return [`${error.code}: ${error.message}`, ...issues];
}

interface FailureOverlayProps {
  readonly dict: FailureWords;
  readonly failure: AnalysisFailure;
  readonly onRetry: () => void;
  readonly onDismiss: () => void;
  readonly ref?: Ref<HTMLDivElement>;
}

export function FailureOverlay({ dict, failure, onRetry, onDismiss, ref }: FailureOverlayProps) {
  const detail = technicalDetail(failure);

  return (
    <div className={OVERLAY_CLASSES}>
      <div
        ref={ref}
        role="alert"
        tabIndex={-1}
        className="my-auto w-full max-w-md border border-ink bg-white p-6 shadow-pixel"
      >
        <h2 className="font-display text-title font-normal tracking-display uppercase">{dict.title}</h2>
        <p className="mt-3 text-body">{failureText(failure, dict)}</p>

        {detail.length > 0 ? (
          <details className="mt-4 text-small text-muted">
            <summary className="flex min-h-11 cursor-pointer items-center font-mono text-label tracking-label uppercase">
              {dict.detailsLabel}
            </summary>
            {/* The server writes these in English; they are for whoever maintains the app. */}
            <ul lang="en" className="mt-1 flex flex-col gap-1 font-mono">
              {detail.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <PixelButton variant="accent" onClick={onRetry}>
            {dict.retry}
          </PixelButton>
          <PixelButton onClick={onDismiss}>{dict.dismiss}</PixelButton>
        </div>
      </div>
    </div>
  );
}
