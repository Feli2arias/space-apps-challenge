"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { runAnalysis, type AnalysisOutcome } from "@/lib/analysis/client";
import type { AnalysisRequest, SourceId } from "@/lib/analysis/types";
import {
  INITIAL_ANALYSIS_STATE,
  analysisReducer,
  type AnalysisAction,
  type AnalysisState,
} from "./analysis-state";

/**
 * Runs analyses against the backend and keeps the screen's view of them.
 *
 * Only one request is ever "current". Starting an analysis, querying a source
 * again or cancelling aborts the request in flight and gives the next one a
 * new number; anything that arrives from a request with an older number is
 * dropped. That is what stops a slow answer for an earlier plot from replacing
 * the results of the plot the person is looking at now.
 */

export interface UseAnalysis {
  readonly state: AnalysisState;
  /** Starts a new analysis, replacing whatever was on screen. */
  readonly start: (request: AnalysisRequest) => void;
  /** Queries one source again while the current results stay on screen. */
  readonly retrySource: (source: SourceId) => void;
  /** Stops the request in flight and clears results and errors. */
  readonly reset: () => void;
  readonly dismissRetryFailure: () => void;
}

/** What the hook remembers between renders without causing one. */
interface RunBook {
  /** Number of the current request. Older requests are ignored. */
  counter: number;
  controller: AbortController | null;
  /** The request whose results are (or will be) on screen, without `refresh`. */
  request: AnalysisRequest | null;
  /** Sources being queried again by the current request. */
  retrying: readonly SourceId[];
}

type SettleAction = Extract<AnalysisAction, { readonly outcome: AnalysisOutcome }>["type"];

export function useAnalysis(): UseAnalysis {
  const [state, dispatch] = useReducer(analysisReducer, INITIAL_ANALYSIS_STATE);
  const book = useRef<RunBook>({ counter: 0, controller: null, request: null, retrying: [] });

  /** Aborts the request in flight and returns the number for the next one. */
  const supersede = useCallback((): number => {
    book.current.controller?.abort();
    book.current.controller = null;
    book.current.counter += 1;
    return book.current.counter;
  }, []);

  const send = useCallback(
    (request: AnalysisRequest, token: number, settleWith: SettleAction, forwardEvents: boolean) => {
      const controller = new AbortController();
      book.current.controller = controller;
      const isCurrent = () => book.current.counter === token;

      void runAnalysis(request, {
        signal: controller.signal,
        onEvent: (event) => {
          if (forwardEvents && isCurrent()) dispatch({ type: "event", event });
        },
      }).then((outcome) => {
        if (!isCurrent()) return;
        book.current.controller = null;
        book.current.retrying = [];
        dispatch({ type: settleWith, outcome });
      });
    },
    [],
  );

  const start = useCallback(
    (request: AnalysisRequest) => {
      const token = supersede();
      book.current.request = request;
      book.current.retrying = [];
      dispatch({ type: "started", request });
      send(request, token, "settled", true);
    },
    [send, supersede],
  );

  const retrySource = useCallback(
    (source: SourceId) => {
      const request = book.current.request;
      if (!request) return;
      // A retry already in flight is replaced by one that asks for both sources:
      // the backend answers the others from its cache, so nothing is lost.
      const sources = Array.from(new Set([...book.current.retrying, source]));
      const token = supersede();
      book.current.retrying = sources;
      dispatch({ type: "retry-started", sources });
      send({ ...request, refresh: sources }, token, "retry-settled", false);
    },
    [send, supersede],
  );

  const reset = useCallback(() => {
    supersede();
    book.current.request = null;
    book.current.retrying = [];
    dispatch({ type: "reset" });
  }, [supersede]);

  const dismissRetryFailure = useCallback(() => dispatch({ type: "retry-failure-dismissed" }), []);

  // Leaving the page stops the request, so the backend stops querying too.
  useEffect(() => {
    const current = book.current;
    return () => {
      current.controller?.abort();
      current.counter += 1;
    };
  }, []);

  return { state, start, retrySource, reset, dismissRetryFailure };
}
