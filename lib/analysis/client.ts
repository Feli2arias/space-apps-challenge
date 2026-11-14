import { z } from "zod";
import {
  SOURCE_IDS,
  type Analysis,
  type AnalysisEvent,
  type AnalysisRequest,
  type ApiError,
} from "./types";

/**
 * Browser side of POST /api/analysis.
 *
 * The backend answers with newline-delimited JSON: one event per line while
 * the sources work, then a final "done" (or "fatal"). This module sends the
 * request, reads that stream as it arrives and reports how it ended. It never
 * throws: every way a request can end is a value the screen can explain.
 */

export const ANALYSIS_ENDPOINT = "/api/analysis";
const NDJSON_CONTENT_TYPE = "application/x-ndjson";

/* ------------------------------------------------------------------ */
/* Reading the stream                                                 */
/* ------------------------------------------------------------------ */

/** One line of the stream: the parsed JSON, or the text that could not be parsed. */
export type NdjsonLine =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly raw: string };

function parseLine(line: string): NdjsonLine {
  try {
    return { ok: true, value: JSON.parse(line) as unknown };
  } catch {
    return { ok: false, raw: line };
  }
}

/**
 * Reads newline-delimited JSON from a byte stream, one line at a time.
 *
 * The network cuts the stream wherever it likes: in the middle of a line, even
 * in the middle of a character. Bytes are decoded as a stream and a line is
 * only handed over once its newline has arrived (or the stream has ended).
 * Blank lines are skipped. A line that is not JSON is handed over as such, so
 * the caller decides what one bad line means for the rest.
 */
export async function* readNdjson(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<NdjsonLine, void, undefined> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });

      const lines = pending.split("\n");
      // Without a newline after it, the last piece may still be growing.
      pending = done ? "" : (lines.pop() ?? "");
      for (const line of lines) {
        const text = line.trim();
        if (text !== "") yield parseLine(text);
      }
      if (done) return;
    }
  } finally {
    // Reached when the caller stops early too: tell the server nobody is listening.
    await reader.cancel().catch(() => undefined);
  }
}

/* ------------------------------------------------------------------ */
/* Checking what arrived                                              */
/* ------------------------------------------------------------------ */

const sourceId = z.enum(SOURCE_IDS);
const anyObject = z.looseObject({});
const dateRange = z.looseObject({ start: z.string(), end: z.string() });

const apiErrorSchema = z.looseObject({
  code: z.enum(["invalid-request", "rate-limited", "not-found", "internal"]),
  message: z.string(),
  issues: z.array(z.looseObject({ path: z.string(), message: z.string() })).optional(),
});

const sourceResultSchema = z.looseObject({
  source: sourceId,
  status: z.enum(["ok", "no-data", "error"]),
  fromCache: z.boolean(),
});

const analysisSchema = z.looseObject({
  id: z.string(),
  status: z.enum(["complete", "partial", "failed"]),
  area: anyObject,
  period: dateRange,
  sources: z.looseObject({
    rain: sourceResultSchema,
    vegetation: sourceResultSchema,
    terrain: sourceResultSchema,
    soil: sourceResultSchema,
    climate: sourceResultSchema,
  }),
});

const eventSchema = z.discriminatedUnion("type", [
  z.looseObject({
    type: z.literal("accepted"),
    analysisId: z.string(),
    area: anyObject,
    period: dateRange,
    sources: z.array(sourceId),
  }),
  z.looseObject({ type: z.literal("source-started"), source: sourceId, fromCache: z.boolean() }),
  z.looseObject({
    type: z.literal("source-progress"),
    source: sourceId,
    progress: z.looseObject({
      stage: z.string(),
      completed: z.number().optional(),
      total: z.number().optional(),
    }),
  }),
  z.looseObject({ type: z.literal("source-finished"), source: sourceId, result: sourceResultSchema }),
  z.looseObject({ type: z.literal("done"), analysis: analysisSchema }),
  z.looseObject({ type: z.literal("fatal"), error: apiErrorSchema }),
]);

/**
 * Accepts a parsed line only when it is an event this client understands.
 *
 * The check covers what the loading screen and this module read (the kind of
 * event, which source, how it ended). The full shape of a result is the
 * backend's contract in `types.ts`; it is produced by our own server, so its
 * inner fields are not validated a second time here.
 */
export function toAnalysisEvent(value: unknown): AnalysisEvent | null {
  const parsed = eventSchema.safeParse(value);
  return parsed.success ? (parsed.data as unknown as AnalysisEvent) : null;
}

/** Reads the error envelope of a non-streaming answer. `null` when it is something else. */
export function toApiError(value: unknown): ApiError | null {
  const parsed = z.looseObject({ success: z.literal(false), error: apiErrorSchema }).safeParse(value);
  return parsed.success ? (parsed.data.error as ApiError) : null;
}

/** Seconds from a `Retry-After` header. Only the plain number form is used. */
export function retryAfterSeconds(headers: Headers): number | null {
  const header = headers.get("retry-after");
  if (header === null || !/^\d+$/.test(header.trim())) return null;
  return Number.parseInt(header, 10);
}

/* ------------------------------------------------------------------ */
/* One analysis                                                       */
/* ------------------------------------------------------------------ */

/** Every way a request for an analysis can end. */
export type AnalysisOutcome =
  /** The stream ended with the whole analysis (which may itself be partial or failed). */
  | { readonly kind: "done"; readonly analysis: Analysis }
  /** The engine stopped and said so. */
  | { readonly kind: "fatal"; readonly error: ApiError }
  /** The request was refused before any analysis started (bad input, too many requests). */
  | {
      readonly kind: "rejected";
      readonly status: number;
      readonly error: ApiError | null;
      readonly retryAfterSeconds: number | null;
    }
  /** The server could not be reached, or the connection dropped while reading. */
  | { readonly kind: "network" }
  /** The stream closed without a "done" or a "fatal". */
  | { readonly kind: "incomplete" }
  /** The answer was not the stream this client expects. */
  | { readonly kind: "bad-response" }
  /** The caller cancelled; there is nothing to show. */
  | { readonly kind: "aborted" };

export type AnalysisFailure = Exclude<AnalysisOutcome, { readonly kind: "done" | "aborted" }>;

export interface RunAnalysisOptions {
  /** Aborts the request when the person changes the selection or leaves. */
  readonly signal: AbortSignal;
  /** Called for every event as it arrives, the final one included. */
  readonly onEvent?: (event: AnalysisEvent) => void;
  /** Replaced in tests. */
  readonly fetchImpl?: typeof fetch;
}

async function readRejection(response: Response): Promise<AnalysisOutcome> {
  const body: unknown = await response.json().catch(() => null);
  return {
    kind: "rejected",
    status: response.status,
    error: toApiError(body),
    retryAfterSeconds: retryAfterSeconds(response.headers),
  };
}

async function readEvents(
  body: ReadableStream<Uint8Array>,
  onEvent: ((event: AnalysisEvent) => void) | undefined,
): Promise<AnalysisOutcome> {
  for await (const line of readNdjson(body)) {
    // A damaged line is skipped: the final "done" repeats every result, so the
    // analysis can still be complete. If "done" itself is lost, the stream
    // ends without it and that is reported as incomplete.
    const event = line.ok ? toAnalysisEvent(line.value) : null;
    if (!event) continue;
    onEvent?.(event);
    if (event.type === "done") return { kind: "done", analysis: event.analysis };
    if (event.type === "fatal") return { kind: "fatal", error: event.error };
  }
  return { kind: "incomplete" };
}

/** Sends one analysis request and follows its stream to the end. Never throws. */
export async function runAnalysis(
  request: AnalysisRequest,
  { signal, onEvent, fetchImpl = fetch }: RunAnalysisOptions,
): Promise<AnalysisOutcome> {
  try {
    const response = await fetchImpl(ANALYSIS_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", accept: NDJSON_CONTENT_TYPE },
      body: JSON.stringify(request),
      cache: "no-store",
      signal,
    });

    if (!response.ok) return await readRejection(response);
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.body || !contentType.includes(NDJSON_CONTENT_TYPE)) {
      return { kind: "bad-response" };
    }
    return await readEvents(response.body, onEvent);
  } catch {
    // `fetch` and the stream reader reject both for a cancelled request and for
    // a dropped connection; the signal tells the two apart.
    return signal.aborted ? { kind: "aborted" } : { kind: "network" };
  }
}
