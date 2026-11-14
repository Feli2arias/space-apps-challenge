import { describe, expect, it } from "vitest";
import type { AnalysisFailure } from "@/lib/analysis/client";
import {
  SOURCE_IDS,
  type Analysis,
  type AnalysisEvent,
  type AnalysisRequest,
  type SourceId,
  type SourceResult,
} from "@/lib/analysis/types";
import {
  INITIAL_ANALYSIS_STATE,
  analysisReducer,
  haveAllSourcesFinished,
  type AnalysisAction,
  type AnalysisState,
} from "./analysis-state";

const REQUEST: AnalysisRequest = {
  area: { kind: "buffer", center: { lat: 10.95, lon: -84.72 }, sideMeters: 200 },
  years: 5,
};

/** Only the fields the reducer reads matter here; the rest of the contract is not exercised. */
function result(source: SourceId, status: SourceResult["status"], fromCache = false): SourceResult {
  return { source, status, fromCache } as SourceResult;
}

function analysis(id: string): Analysis {
  return { id, status: "partial" } as Analysis;
}

const accepted: AnalysisEvent = {
  type: "accepted",
  analysisId: "abc",
  area: {} as Analysis["area"],
  period: { start: "2021-01-01", end: "2025-12-31" },
  sources: ["rain", "terrain"],
};

const event = (value: AnalysisEvent): AnalysisAction => ({ type: "event", event: value });

function run(...actions: readonly AnalysisAction[]): AnalysisState {
  return actions.reduce(analysisReducer, INITIAL_ANALYSIS_STATE);
}

const started: AnalysisAction = { type: "started", request: REQUEST };
const stateOf = (state: AnalysisState, id: SourceId) => state.tracks.find((track) => track.id === id);

describe("analysisReducer while loading", () => {
  it("starts with every source waiting and nothing confirmed", () => {
    const state = run(started);
    expect(state.phase).toBe("loading");
    expect(state.request).toBe(REQUEST);
    expect(state.accepted).toBe(false);
    expect(state.tracks.map((track) => track.id)).toEqual([...SOURCE_IDS]);
    expect(state.tracks.every((track) => track.state === "waiting")).toBe(true);
  });

  it("keeps only the sources the backend says it will query", () => {
    const state = run(started, event(accepted));
    expect(state.accepted).toBe(true);
    expect(state.tracks.map((track) => track.id)).toEqual(["rain", "terrain"]);
  });

  it("follows a source from waiting to running to done", () => {
    const running = run(started, event(accepted), event({ type: "source-started", source: "rain", fromCache: false }));
    expect(stateOf(running, "rain")?.state).toBe("running");
    expect(stateOf(running, "terrain")?.state).toBe("waiting");

    const finished = analysisReducer(
      running,
      event({ type: "source-finished", source: "rain", result: result("rain", "ok") }),
    );
    expect(stateOf(finished, "rain")?.state).toBe("done");
  });

  it("counts a source without data as done and a source with an error as failed", () => {
    const state = run(
      started,
      event(accepted),
      event({ type: "source-finished", source: "rain", result: result("rain", "no-data") }),
      event({ type: "source-finished", source: "terrain", result: result("terrain", "error") }),
    );
    expect(stateOf(state, "rain")?.state).toBe("done");
    expect(stateOf(state, "terrain")?.state).toBe("failed");
  });

  it("remembers that a result came from the cache", () => {
    const state = run(
      started,
      event(accepted),
      event({ type: "source-started", source: "rain", fromCache: true }),
      event({ type: "source-finished", source: "rain", result: result("rain", "ok", true) }),
    );
    expect(stateOf(state, "rain")).toMatchObject({ state: "done", fromCache: true });
  });

  it("keeps the latest progress of each source and the order in which they reported", () => {
    const state = run(
      started,
      event(accepted),
      event({ type: "source-progress", source: "rain", progress: { stage: "a", completed: 1, total: 5 } }),
      event({ type: "source-progress", source: "terrain", progress: { stage: "b" } }),
      event({ type: "source-progress", source: "rain", progress: { stage: "a", completed: 2, total: 5 } }),
    );
    expect(stateOf(state, "rain")?.progress).toEqual({ stage: "a", completed: 2, total: 5 });
    expect(state.progressOrder).toEqual(["terrain", "rain"]);
  });

  it("drops a finished source from the progress order", () => {
    const state = run(
      started,
      event(accepted),
      event({ type: "source-progress", source: "terrain", progress: { stage: "b" } }),
      event({ type: "source-progress", source: "rain", progress: { stage: "a" } }),
      event({ type: "source-finished", source: "rain", result: result("rain", "ok") }),
    );
    expect(state.progressOrder).toEqual(["terrain"]);
  });

  it("knows when every source has finished but the answer has not arrived", () => {
    const one = run(
      started,
      event(accepted),
      event({ type: "source-finished", source: "rain", result: result("rain", "ok") }),
    );
    expect(haveAllSourcesFinished(one)).toBe(false);

    const all = analysisReducer(
      one,
      event({ type: "source-finished", source: "terrain", result: result("terrain", "error") }),
    );
    expect(haveAllSourcesFinished(all)).toBe(true);
    expect(all.phase).toBe("loading");
  });

  it("does not call an unaccepted request finished", () => {
    expect(haveAllSourcesFinished(run(started))).toBe(false);
    expect(haveAllSourcesFinished(INITIAL_ANALYSIS_STATE)).toBe(false);
  });

  it("does not finish on the done event alone: the outcome settles it", () => {
    const state = run(started, event(accepted), event({ type: "done", analysis: analysis("abc") }));
    expect(state.phase).toBe("loading");
  });
});

describe("analysisReducer when the request ends", () => {
  it("shows the analysis when it is done", () => {
    const state = run(started, event(accepted), { type: "settled", outcome: { kind: "done", analysis: analysis("abc") } });
    expect(state.phase).toBe("done");
    expect(state.analysis?.id).toBe("abc");
    expect(state.request).toBe(REQUEST);
  });

  it.each<AnalysisFailure>([
    { kind: "network" },
    { kind: "incomplete" },
    { kind: "bad-response" },
    { kind: "fatal", error: { code: "internal", message: "x" } },
    { kind: "rejected", status: 429, error: null, retryAfterSeconds: 30 },
  ])("ends the loading state on $kind and keeps the request for a retry", (failure) => {
    const state = run(started, { type: "settled", outcome: failure });
    expect(state.phase).toBe("error");
    expect(state.failure).toEqual(failure);
    expect(state.analysis).toBeNull();
    expect(state.request).toBe(REQUEST);
  });

  it("ignores an aborted request", () => {
    const loading = run(started);
    expect(analysisReducer(loading, { type: "settled", outcome: { kind: "aborted" } })).toBe(loading);
  });

  it("ignores events and outcomes that arrive when nothing is loading", () => {
    const idle = INITIAL_ANALYSIS_STATE;
    expect(analysisReducer(idle, event(accepted))).toBe(idle);
    expect(analysisReducer(idle, { type: "settled", outcome: { kind: "network" } })).toBe(idle);

    const done = run(started, { type: "settled", outcome: { kind: "done", analysis: analysis("abc") } });
    expect(analysisReducer(done, event(accepted))).toBe(done);
    expect(analysisReducer(done, { type: "settled", outcome: { kind: "network" } })).toBe(done);
  });

  it("starts clean when a new analysis begins", () => {
    const failed = run(started, { type: "settled", outcome: { kind: "network" } });
    const again = analysisReducer(failed, started);
    expect(again).toEqual({ ...INITIAL_ANALYSIS_STATE, phase: "loading", request: REQUEST });
  });

  it("goes back to the beginning on reset", () => {
    const done = run(started, { type: "settled", outcome: { kind: "done", analysis: analysis("abc") } });
    expect(analysisReducer(done, { type: "reset" })).toBe(INITIAL_ANALYSIS_STATE);
  });
});

describe("analysisReducer when one source is queried again", () => {
  const done = run(started, { type: "settled", outcome: { kind: "done", analysis: analysis("first") } });

  it("marks the sources and keeps the results on screen", () => {
    const state = analysisReducer(done, { type: "retry-started", sources: ["rain"] });
    expect(state.phase).toBe("done");
    expect(state.retrying).toEqual(["rain"]);
    expect(state.analysis?.id).toBe("first");
  });

  it("replaces the analysis when the retry answers", () => {
    const state = [
      { type: "retry-started", sources: ["rain"] } as const,
      { type: "retry-settled", outcome: { kind: "done", analysis: analysis("second") } } as const,
    ].reduce<AnalysisState>(analysisReducer, done);
    expect(state.analysis?.id).toBe("second");
    expect(state.retrying).toEqual([]);
    expect(state.retryFailure).toBeNull();
  });

  it("keeps the earlier results when the retry fails, and says which sources failed", () => {
    const state = [
      { type: "retry-started", sources: ["rain", "soil"] } as const,
      { type: "retry-settled", outcome: { kind: "network" } } as const,
    ].reduce<AnalysisState>(analysisReducer, done);
    expect(state.phase).toBe("done");
    expect(state.analysis?.id).toBe("first");
    expect(state.retrying).toEqual([]);
    expect(state.retryFailure).toEqual({ sources: ["rain", "soil"], failure: { kind: "network" } });
  });

  it("clears an earlier retry failure when another retry starts or the notice is closed", () => {
    const failed = [
      { type: "retry-started", sources: ["rain"] } as const,
      { type: "retry-settled", outcome: { kind: "network" } } as const,
    ].reduce<AnalysisState>(analysisReducer, done);
    expect(analysisReducer(failed, { type: "retry-started", sources: ["rain"] }).retryFailure).toBeNull();
    expect(analysisReducer(failed, { type: "retry-failure-dismissed" }).retryFailure).toBeNull();
  });

  it("does not start a retry without results", () => {
    const loading = run(started);
    expect(analysisReducer(loading, { type: "retry-started", sources: ["rain"] })).toBe(loading);
    expect(analysisReducer(loading, { type: "retry-settled", outcome: { kind: "network" } })).toBe(loading);
  });

  it("ignores the events of a retry: only its outcome matters", () => {
    const retrying = analysisReducer(done, { type: "retry-started", sources: ["rain"] });
    expect(analysisReducer(retrying, event(accepted))).toBe(retrying);
  });
});
