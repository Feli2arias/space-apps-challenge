import { useEffect, useState } from "react";
import type { RotationComparisonResult } from "@/lib/rotation/compare";
import type { RotationRequest } from "@/lib/rotation/schema";
import { postRotations, type ComparisonFailure } from "./api";

/**
 * Keeps the comparison in step with what the person declares. Each change
 * waits a moment (debounce), aborts the request still in flight and ignores
 * any answer that arrives for an older version of the plans.
 */

/** Long enough to group a burst of taps on the month grid into one request. */
export const COMPARISON_DEBOUNCE_MS = 300;

interface Settled {
  /** The request (serialized) the stored answer belongs to. */
  readonly key: string;
  readonly result: RotationComparisonResult | null;
  readonly failure: Exclude<ComparisonFailure, "aborted"> | null;
}

export interface ComparisonState {
  /** The latest answer, possibly for an older version of the plans; check `pending`. */
  readonly result: RotationComparisonResult | null;
  /** True while the shown answer does not yet match the current plans. */
  readonly pending: boolean;
  readonly failure: Exclude<ComparisonFailure, "aborted"> | null;
}

export function useRotationComparison(request: RotationRequest): ComparisonState {
  const key = JSON.stringify(request);
  const [settled, setSettled] = useState<Settled | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void postRotations(JSON.parse(key) as RotationRequest, controller.signal).then((outcome) => {
        // A newer change aborted this request: its answer is stale.
        if (controller.signal.aborted) return;
        setSettled((previous) =>
          outcome.ok
            ? { key, result: outcome.result, failure: null }
            : {
                key,
                result: previous?.result ?? null,
                failure: outcome.failure === "aborted" ? null : outcome.failure,
              },
        );
      });
    }, COMPARISON_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);

  const current = settled?.key === key;
  return {
    result: settled?.result ?? null,
    pending: !current,
    failure: current ? (settled?.failure ?? null) : null,
  };
}
