import type { SourceErrorInfo, SourceId } from "./types";

/**
 * Server-side record of what went wrong. Failures of the data services are
 * shown to the visitor in plain words; the technical cause is written here so
 * whoever runs the server can see why, with the time it happened.
 */
export function logSourceFailure(
  analysisId: string,
  source: SourceId,
  error: SourceErrorInfo,
  durationMs: number,
): void {
  console.error(
    `[analysis ${analysisId}] ${source} failed after ${durationMs} ms: ${error.code} — ${error.detail}`,
  );
}
