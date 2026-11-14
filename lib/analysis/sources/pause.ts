import { SourceError } from "../errors";

/**
 * Waits `ms` milliseconds, or rejects with an "aborted" `SourceError` as soon
 * as the analysis is cancelled. Used to keep to the request limits of the
 * open data services without holding on to a cancelled analysis.
 */
export function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new SourceError("aborted", "The request was cancelled."));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
}
