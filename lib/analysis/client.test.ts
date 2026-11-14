import { describe, expect, it } from "vitest";
import {
  readNdjson,
  retryAfterSeconds,
  runAnalysis,
  toAnalysisEvent,
  toApiError,
  type NdjsonLine,
} from "./client";
import { SOURCE_IDS, type AnalysisEvent, type AnalysisRequest, type SourceId } from "./types";

const encoder = new TextEncoder();

/** A stream that delivers exactly the given chunks, one per read. */
function streamOf(chunks: readonly Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(chunk));
      controller.close();
    },
  });
}

function textStream(...pieces: readonly string[]): ReadableStream<Uint8Array> {
  return streamOf(pieces.map((piece) => encoder.encode(piece)));
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<NdjsonLine[]> {
  const lines: NdjsonLine[] = [];
  for await (const line of readNdjson(stream)) lines.push(line);
  return lines;
}

const values = (lines: readonly NdjsonLine[]) => lines.map((line) => (line.ok ? line.value : "BAD"));

describe("readNdjson", () => {
  it("reads one value per line", async () => {
    const lines = await collect(textStream('{"a":1}\n{"a":2}\n'));
    expect(values(lines)).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("joins a line that arrives split across chunks", async () => {
    const lines = await collect(textStream('{"type":"acc', 'epted","n"', ":1}\n", '{"type":"done"}\n'));
    expect(values(lines)).toEqual([{ type: "accepted", n: 1 }, { type: "done" }]);
  });

  it("reads several lines that arrive in one chunk", async () => {
    const lines = await collect(textStream('{"a":1}\n{"a":2}\n{"a":3}\n'));
    expect(values(lines)).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }]);
  });

  it("waits for the newline before handing over a partial line", async () => {
    const seen: unknown[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode('{"a":1}\n{"a":'));
        await gate;
        controller.enqueue(encoder.encode("2}\n"));
        controller.close();
      },
    });

    const reading = (async () => {
      for await (const line of readNdjson(stream)) seen.push(line.ok ? line.value : "BAD");
    })();
    // Give the reader time to consume the first chunk.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(seen).toEqual([{ a: 1 }]);

    release();
    await reading;
    expect(seen).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("reads a last line that has no newline after it", async () => {
    const lines = await collect(textStream('{"a":1}\n{"a":2}'));
    expect(values(lines)).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("keeps a character whose bytes are split across chunks", async () => {
    const bytes = encoder.encode('{"text":"año ñandú"}\n');
    // Byte 11 falls inside the two-byte "ñ" of "año".
    const lines = await collect(streamOf([bytes.slice(0, 11), bytes.slice(11)]));
    expect(values(lines)).toEqual([{ text: "año ñandú" }]);
  });

  it("skips blank lines and accepts Windows line endings", async () => {
    const lines = await collect(textStream('\n{"a":1}\r\n\r\n   \n{"a":2}\r\n'));
    expect(values(lines)).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("hands over a malformed line as such and keeps reading", async () => {
    const lines = await collect(textStream('{"a":1}\n{"a":\n{"a":3}\n'));
    expect(lines).toEqual([
      { ok: true, value: { a: 1 } },
      { ok: false, raw: '{"a":' },
      { ok: true, value: { a: 3 } },
    ]);
  });

  it("yields nothing for an empty stream", async () => {
    expect(await collect(textStream())).toEqual([]);
    expect(await collect(textStream(""))).toEqual([]);
  });

  it("cancels the stream when the caller stops early", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"a":1}\n{"a":2}\n'));
      },
      cancel() {
        cancelled = true;
      },
    });
    for await (const line of readNdjson(stream)) {
      expect(line.ok).toBe(true);
      break;
    }
    expect(cancelled).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

const REQUEST: AnalysisRequest = {
  area: { kind: "buffer", center: { lat: 10.95, lon: -84.72 }, sideMeters: 200 },
  years: 5,
};

function failedResult(source: SourceId) {
  return {
    source,
    status: "error",
    fromCache: false,
    error: { code: "not-implemented", detail: "Not connected yet.", retryable: false },
  };
}

const ANALYSIS = {
  id: "7b55aec15fc11336",
  status: "failed",
  area: { kind: "buffer" },
  period: { start: "2021-01-01", end: "2025-12-31" },
  sources: Object.fromEntries(SOURCE_IDS.map((source) => [source, failedResult(source)])),
};

const EVENTS: readonly unknown[] = [
  { type: "accepted", analysisId: ANALYSIS.id, area: ANALYSIS.area, period: ANALYSIS.period, sources: SOURCE_IDS },
  { type: "source-started", source: "rain", fromCache: false },
  { type: "source-progress", source: "rain", progress: { stage: "downloading", completed: 1, total: 5 } },
  { type: "source-finished", source: "rain", result: failedResult("rain") },
  { type: "done", analysis: ANALYSIS },
];

const ndjson = (events: readonly unknown[]) => events.map((event) => `${JSON.stringify(event)}\n`).join("");

function streamResponse(...pieces: readonly string[]): Response {
  return new Response(textStream(...pieces), {
    status: 200,
    headers: { "content-type": "application/x-ndjson; charset=utf-8" },
  });
}

/** A `fetch` that answers with a fixed response and remembers how it was called. */
function fakeFetch(answer: Response | Error) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { fetchImpl, calls };
}

async function run(answer: Response | Error, controller = new AbortController()) {
  const events: AnalysisEvent[] = [];
  const { fetchImpl, calls } = fakeFetch(answer);
  const outcome = await runAnalysis(REQUEST, {
    signal: controller.signal,
    onEvent: (event) => events.push(event),
    fetchImpl,
  });
  return { outcome, events, calls };
}

describe("runAnalysis", () => {
  it("posts the request as JSON", async () => {
    const { calls } = await run(streamResponse(ndjson(EVENTS)));
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/analysis");
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual(REQUEST);
  });

  it("reports every event in order and ends with the analysis", async () => {
    const { outcome, events } = await run(streamResponse(ndjson(EVENTS)));
    expect(events.map((event) => event.type)).toEqual([
      "accepted",
      "source-started",
      "source-progress",
      "source-finished",
      "done",
    ]);
    expect(outcome).toMatchObject({ kind: "done", analysis: { id: ANALYSIS.id, status: "failed" } });
  });

  it("gives the same result when the stream arrives in awkward pieces", async () => {
    const text = ndjson(EVENTS);
    const pieces = text.match(/[\s\S]{1,37}/g) ?? [];
    const { outcome, events } = await run(streamResponse(...pieces));
    expect(events).toHaveLength(EVENTS.length);
    expect(outcome.kind).toBe("done");
  });

  it("skips a malformed line and an unknown event, and still finishes", async () => {
    const text = [
      JSON.stringify(EVENTS[0]),
      '{"type":"source-started","source":',
      JSON.stringify({ type: "something-new", source: "rain" }),
      JSON.stringify({ type: "source-started", source: "weather", fromCache: false }),
      JSON.stringify(EVENTS[4]),
      "",
    ].join("\n");
    const { outcome, events } = await run(streamResponse(text));
    expect(events.map((event) => event.type)).toEqual(["accepted", "done"]);
    expect(outcome.kind).toBe("done");
  });

  it("reports a stream that ends without a final event as incomplete", async () => {
    const { outcome, events } = await run(streamResponse(ndjson(EVENTS.slice(0, 4))));
    expect(events).toHaveLength(4);
    expect(outcome).toEqual({ kind: "incomplete" });
  });

  it("reports a damaged final event as incomplete", async () => {
    const text = ndjson(EVENTS.slice(0, 4)) + JSON.stringify(EVENTS[4]).slice(0, 40);
    expect((await run(streamResponse(text))).outcome).toEqual({ kind: "incomplete" });
  });

  it("stops at a fatal event", async () => {
    const error = { code: "internal", message: "The analysis could not be completed." };
    const text = ndjson([EVENTS[0], { type: "fatal", error }, EVENTS[4]]);
    const { outcome, events } = await run(streamResponse(text));
    expect(outcome).toEqual({ kind: "fatal", error });
    expect(events.map((event) => event.type)).toEqual(["accepted", "fatal"]);
  });

  it("reads the error envelope of a refused request", async () => {
    const error = {
      code: "invalid-request",
      message: "The selected area is not valid.",
      issues: [{ path: "area", message: "The area must be at most 500 hectares." }],
    };
    const response = Response.json({ success: false, data: null, error }, { status: 400 });
    expect((await run(response)).outcome).toEqual({
      kind: "rejected",
      status: 400,
      error,
      retryAfterSeconds: null,
    });
  });

  it("reads how long to wait after too many requests", async () => {
    const error = { code: "rate-limited", message: "Too many analyses in a short time." };
    const response = Response.json(
      { success: false, data: null, error },
      { status: 429, headers: { "retry-after": "42" } },
    );
    expect((await run(response)).outcome).toEqual({
      kind: "rejected",
      status: 429,
      error,
      retryAfterSeconds: 42,
    });
  });

  it("reports a refusal it cannot read without inventing a reason", async () => {
    const response = new Response("<html>Bad gateway</html>", { status: 502 });
    expect((await run(response)).outcome).toEqual({
      kind: "rejected",
      status: 502,
      error: null,
      retryAfterSeconds: null,
    });
  });

  it("refuses a 200 answer that is not the expected stream", async () => {
    const response = Response.json({ success: true, data: {}, error: null });
    expect((await run(response)).outcome).toEqual({ kind: "bad-response" });
  });

  it("reports a network failure", async () => {
    expect((await run(new TypeError("Failed to fetch"))).outcome).toEqual({ kind: "network" });
  });

  it("reports a connection that drops while reading", async () => {
    const broken = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(ndjson(EVENTS.slice(0, 2))));
      },
      pull(controller) {
        controller.error(new TypeError("network error"));
      },
    });
    const response = new Response(broken, { headers: { "content-type": "application/x-ndjson" } });
    const { outcome, events } = await run(response);
    expect(events).toHaveLength(2);
    expect(outcome).toEqual({ kind: "network" });
  });

  it("reports a cancelled request as aborted, not as a failure", async () => {
    const controller = new AbortController();
    controller.abort();
    const { outcome } = await run(new DOMException("Aborted", "AbortError"), controller);
    expect(outcome).toEqual({ kind: "aborted" });
  });
});

describe("toAnalysisEvent", () => {
  it("accepts each kind of event", () => {
    EVENTS.forEach((event) => expect(toAnalysisEvent(event)).not.toBeNull());
    expect(toAnalysisEvent({ type: "fatal", error: { code: "internal", message: "x" } })).not.toBeNull();
  });

  it("keeps fields it does not check", () => {
    const event = toAnalysisEvent(EVENTS[3]);
    expect(event).toMatchObject({ result: { error: { code: "not-implemented" } } });
  });

  it("rejects anything else", () => {
    expect(toAnalysisEvent(null)).toBeNull();
    expect(toAnalysisEvent("done")).toBeNull();
    expect(toAnalysisEvent({ type: "done" })).toBeNull();
    expect(toAnalysisEvent({ type: "source-progress", source: "rain", progress: {} })).toBeNull();
    expect(toAnalysisEvent({ type: "done", analysis: { ...ANALYSIS, sources: {} } })).toBeNull();
  });
});

describe("envelope helpers", () => {
  it("reads only a failed envelope", () => {
    const error = { code: "internal", message: "x" };
    expect(toApiError({ success: false, data: null, error })).toEqual(error);
    expect(toApiError({ success: true, data: {}, error: null })).toBeNull();
    expect(toApiError({ success: false, error: { code: "nope", message: "x" } })).toBeNull();
    expect(toApiError(null)).toBeNull();
  });

  it("reads Retry-After only when it is a whole number of seconds", () => {
    expect(retryAfterSeconds(new Headers({ "retry-after": "30" }))).toBe(30);
    expect(retryAfterSeconds(new Headers({ "retry-after": "Wed, 21 Oct 2026 07:28:00 GMT" }))).toBeNull();
    expect(retryAfterSeconds(new Headers())).toBeNull();
  });
});
