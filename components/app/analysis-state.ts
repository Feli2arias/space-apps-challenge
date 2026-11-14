import type { AnalysisFailure, AnalysisOutcome } from "@/lib/analysis/client";
import {
  SOURCE_IDS,
  type Analysis,
  type AnalysisEvent,
  type AnalysisRequest,
  type SourceId,
  type SourceProgress,
} from "@/lib/analysis/types";
import type { LoaderSourceState } from "./seed-loader";

/**
 * What the screen knows about the current analysis, and how each piece of news
 * from the backend changes it. Everything here is derived from events that
 * really arrived: nothing is estimated, timed or assumed.
 */

/** One data source while the analysis is running. */
export interface SourceTrack {
  readonly id: SourceId;
  readonly state: LoaderSourceState;
  /** True when the backend said this result comes from its cache. */
  readonly fromCache: boolean;
  /** The last progress the source reported. `null` until it reports any. */
  readonly progress: SourceProgress | null;
}

export type AnalysisPhase = "idle" | "loading" | "done" | "error";

export interface RetryFailure {
  readonly sources: readonly SourceId[];
  readonly failure: AnalysisFailure;
}

export interface AnalysisState {
  readonly phase: AnalysisPhase;
  /** The request being answered, or the one the shown results answer. */
  readonly request: AnalysisRequest | null;
  /** True once the backend confirmed it accepted the request. */
  readonly accepted: boolean;
  readonly tracks: readonly SourceTrack[];
  /**
   * Running sources that have reported progress, oldest report first. The last
   * one is what the backend most recently confirmed it is doing.
   */
  readonly progressOrder: readonly SourceId[];
  readonly analysis: Analysis | null;
  readonly failure: AnalysisFailure | null;
  /** Sources being queried again while the results stay on screen. */
  readonly retrying: readonly SourceId[];
  readonly retryFailure: RetryFailure | null;
}

export type AnalysisAction =
  | { readonly type: "started"; readonly request: AnalysisRequest }
  | { readonly type: "event"; readonly event: AnalysisEvent }
  | { readonly type: "settled"; readonly outcome: AnalysisOutcome }
  | { readonly type: "retry-started"; readonly sources: readonly SourceId[] }
  | { readonly type: "retry-settled"; readonly outcome: AnalysisOutcome }
  | { readonly type: "retry-failure-dismissed" }
  | { readonly type: "reset" };

function waitingTracks(sources: readonly SourceId[]): readonly SourceTrack[] {
  return sources.map((id) => ({ id, state: "waiting", fromCache: false, progress: null }));
}

export const INITIAL_ANALYSIS_STATE: AnalysisState = {
  phase: "idle",
  request: null,
  accepted: false,
  tracks: waitingTracks(SOURCE_IDS),
  progressOrder: [],
  analysis: null,
  failure: null,
  retrying: [],
  retryFailure: null,
};

function updateTrack(
  tracks: readonly SourceTrack[],
  id: SourceId,
  change: Partial<Omit<SourceTrack, "id">>,
): readonly SourceTrack[] {
  return tracks.map((track) => (track.id === id ? { ...track, ...change } : track));
}

const without = (order: readonly SourceId[], id: SourceId): readonly SourceId[] =>
  order.filter((other) => other !== id);

function applyEvent(state: AnalysisState, event: AnalysisEvent): AnalysisState {
  switch (event.type) {
    case "accepted":
      return { ...state, accepted: true, tracks: waitingTracks(event.sources), progressOrder: [] };
    case "source-started":
      return {
        ...state,
        tracks: updateTrack(state.tracks, event.source, { state: "running", fromCache: event.fromCache }),
      };
    case "source-progress":
      return {
        ...state,
        tracks: updateTrack(state.tracks, event.source, { state: "running", progress: event.progress }),
        progressOrder: [...without(state.progressOrder, event.source), event.source],
      };
    case "source-finished":
      return {
        ...state,
        tracks: updateTrack(state.tracks, event.source, {
          state: event.result.status === "error" ? "failed" : "done",
          fromCache: event.result.fromCache,
        }),
        progressOrder: without(state.progressOrder, event.source),
      };
    // The end of the stream is handled once, by "settled", with its outcome.
    case "done":
    case "fatal":
      return state;
  }
}

function settle(state: AnalysisState, outcome: AnalysisOutcome): AnalysisState {
  if (outcome.kind === "aborted") return state;
  if (outcome.kind === "done") {
    return { ...state, phase: "done", analysis: outcome.analysis, failure: null, progressOrder: [] };
  }
  return { ...state, phase: "error", analysis: null, failure: outcome, progressOrder: [] };
}

function settleRetry(state: AnalysisState, outcome: AnalysisOutcome): AnalysisState {
  if (outcome.kind === "aborted") return state;
  if (outcome.kind === "done") {
    return { ...state, analysis: outcome.analysis, retrying: [], retryFailure: null };
  }
  // The results already on screen are still true; only the retry failed.
  return { ...state, retrying: [], retryFailure: { sources: state.retrying, failure: outcome } };
}

/** Returns the state after one piece of news. The input is never modified. */
export function analysisReducer(state: AnalysisState, action: AnalysisAction): AnalysisState {
  switch (action.type) {
    case "started":
      return { ...INITIAL_ANALYSIS_STATE, phase: "loading", request: action.request };
    case "event":
      return state.phase === "loading" ? applyEvent(state, action.event) : state;
    case "settled":
      return state.phase === "loading" ? settle(state, action.outcome) : state;
    case "retry-started":
      return state.phase === "done" ? { ...state, retrying: action.sources, retryFailure: null } : state;
    case "retry-settled":
      return state.phase === "done" ? settleRetry(state, action.outcome) : state;
    case "retry-failure-dismissed":
      return { ...state, retryFailure: null };
    case "reset":
      return INITIAL_ANALYSIS_STATE;
  }
}

/** True when every source of an accepted request has reported how it ended. */
export function haveAllSourcesFinished(state: AnalysisState): boolean {
  return (
    state.accepted &&
    state.tracks.length > 0 &&
    state.tracks.every((track) => track.state === "done" || track.state === "failed")
  );
}
