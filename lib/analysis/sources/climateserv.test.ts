import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SourceError } from "../errors";
import { bufferArea } from "../geometry";
import {
  buildSubmitUrl,
  createSerialGate,
  IMERG_LATE_DAILY_V07_DATASET_ID,
  MISSING_VALUE,
  parseDailyAverageResponse,
  parseProgressResponse,
  parseSubmitResponse,
  runDailyAverageJob,
  toServiceDate,
  type DailyAverageJob,
} from "./climateserv";

/** Real ClimateSERV answers captured on 2026-11-14 (see `__fixtures__/rain-*`). */
function fixtureText(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8");
}

function fixture(name: string): unknown {
  return JSON.parse(fixtureText(name)) as unknown;
}

const ACCEPTED_ID = "d2a687d8-5b62-4567-9f0d-e13c94b54b57";
const testArea = bufferArea({ lat: 10.95, lon: -84.72 }, 200);

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof SourceError ? error.code : `not a SourceError: ${String(error)}`;
  }
  return "resolved";
}

function codeThrownBy(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    return error instanceof SourceError ? error.code : `not a SourceError: ${String(error)}`;
  }
  return "returned";
}

describe("toServiceDate", () => {
  it("writes dates the way the service expects", () => {
    expect(toServiceDate("2025-01-31")).toBe("01/31/2025");
  });
});

describe("createSerialGate", () => {
  it("runs one task at a time, in order, and is not blocked by a failure", async () => {
    const gate = createSerialGate();
    const events: string[] = [];
    const task = (name: string, fails = false) => async (): Promise<string> => {
      events.push(`start ${name}`);
      await Promise.resolve();
      events.push(`end ${name}`);
      if (fails) throw new Error(name);
      return name;
    };

    const results = await Promise.allSettled([gate(task("a")), gate(task("b", true)), gate(task("c"))]);

    expect(events).toEqual(["start a", "end a", "start b", "end b", "start c", "end c"]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
  });
});

describe("buildSubmitUrl", () => {
  it("sends the documented parameters in the query string", () => {
    const url = new URL(
      buildSubmitUrl({
        datasetId: IMERG_LATE_DAILY_V07_DATASET_ID,
        start: "2025-01-01",
        end: "2025-12-31",
        polygon: testArea.polygon,
      }),
    );
    expect(url.origin + url.pathname).toBe("https://climateserv.servirglobal.net/api/submitDataRequest/");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      datatype: "226",
      begintime: "01/01/2025",
      endtime: "12/31/2025",
      intervaltype: "0",
      operationtype: "5",
    });
    expect(JSON.parse(url.searchParams.get("geometry") ?? "")).toEqual({
      type: "Polygon",
      coordinates: testArea.polygon.coordinates,
    });
  });
});

describe("parseSubmitResponse", () => {
  it("returns the job id", () => {
    expect(parseSubmitResponse(fixture("rain-submit-accepted.json"))).toBe(ACCEPTED_ID);
  });

  it("treats an id that comes with a remark as a refusal", () => {
    // The service answers a 25-year request with an id and "Max date range is: 20 years".
    expect(codeThrownBy(() => parseSubmitResponse(fixture("rain-submit-refused.json")))).toBe("upstream-error");
  });

  it("rejects anything that is not a list starting with an id", () => {
    expect(codeThrownBy(() => parseSubmitResponse([]))).toBe("bad-response");
    expect(codeThrownBy(() => parseSubmitResponse({ id: ACCEPTED_ID }))).toBe("bad-response");
    expect(codeThrownBy(() => parseSubmitResponse(["Error with begintime"]))).toBe("upstream-error");
  });
});

describe("parseProgressResponse", () => {
  it("reads running, finished and failed jobs", () => {
    expect(parseProgressResponse(fixture("rain-progress-running.json"))).toBe(98.5);
    expect(parseProgressResponse(fixture("rain-progress-done.json"))).toBe(100);
    expect(parseProgressResponse(fixture("rain-progress-failed.json"))).toBe(-1);
  });

  it("rejects an unreadable progress", () => {
    expect(codeThrownBy(() => parseProgressResponse(["100"]))).toBe("bad-response");
    expect(codeThrownBy(() => parseProgressResponse([]))).toBe("bad-response");
  });
});

describe("parseDailyAverageResponse", () => {
  it("reads a full year, oldest day first, in millimetres", () => {
    const days = parseDailyAverageResponse(fixture("rain-imerg-late-v07-2025.json"));
    expect(days).toHaveLength(365);
    expect(days?.[0].date).toBe("2025-01-01");
    expect(days?.[0].mm).toBeCloseTo(4.8, 5);
    // The last day of 2025 is a real zero in the answer: a day without rain, not a missing day.
    expect(days?.[364]).toEqual({ date: "2025-12-31", mm: 0 });
    expect(days?.every((day) => day.mm !== null && day.mm >= 0)).toBe(true);
    const total = (days ?? []).reduce((sum, day) => sum + (day.mm ?? 0), 0);
    // About 2,648 mm: in the range northern Costa Rica really gets, so the unit needs no factor.
    expect(total).toBeCloseTo(2647.9, 0);
  });

  it("returns the days the service has when some are absent (May 2024 is not on the service)", () => {
    const days = parseDailyAverageResponse(fixture("rain-imerg-late-v07-2024.json")) ?? [];
    expect(days).toHaveLength(334);
    expect(days.some((day) => day.date.startsWith("2024-05"))).toBe(false);
  });

  it("reads an answer without days as an empty list", () => {
    expect(parseDailyAverageResponse(fixture("rain-empty-result.json"))).toEqual([]);
  });

  it("returns null when the result file is not readable yet", () => {
    expect(parseDailyAverageResponse(fixture("rain-result-not-ready.json"))).toBeNull();
  });

  it("turns the missing marker into null and keeps zero as zero", () => {
    // Rows in the service's shape; the marker is the one its source code writes for "not a number".
    const days = parseDailyAverageResponse({
      data: [
        { date: "01/02/2025", value: { avg: MISSING_VALUE } },
        { date: "01/01/2025", value: { avg: 0 } },
      ],
    });
    expect(days).toEqual([
      { date: "2025-01-01", mm: 0 },
      { date: "2025-01-02", mm: null },
    ]);
  });

  it("rejects an unknown shape", () => {
    expect(codeThrownBy(() => parseDailyAverageResponse({ data: [{ date: "2025-01-01", value: 3 }] }))).toBe(
      "bad-response",
    );
    expect(codeThrownBy(() => parseDailyAverageResponse("need to send id"))).toBe("bad-response");
  });
});

describe("runDailyAverageJob", () => {
  /** Answers the three endpoints from queues of captured bodies; the last body of a queue repeats. */
  function stubService(script: { readonly progress: readonly string[]; readonly result: readonly string[] }) {
    const calls: string[] = [];
    const next = (queue: readonly string[], seen: number): string => queue[Math.min(seen, queue.length - 1)];
    let progressCalls = 0;
    let resultCalls = 0;

    vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const url = String(input);
      calls.push(`${init?.method ?? "GET"} ${new URL(url).pathname}`);
      if (url.includes("/submitDataRequest/")) return new Response(fixtureText("rain-submit-accepted.json"));
      if (url.includes("/getDataRequestProgress/")) return new Response(next(script.progress, progressCalls++));
      return new Response(next(script.result, resultCalls++));
    });
    return calls;
  }

  function job(overrides: Partial<DailyAverageJob> = {}): DailyAverageJob {
    return {
      datasetId: IMERG_LATE_DAILY_V07_DATASET_ID,
      start: "2025-01-01",
      end: "2025-12-31",
      polygon: testArea.polygon,
      signal: new AbortController().signal,
      timeoutMs: 60_000,
      ...overrides,
    };
  }

  const running = fixtureText("rain-progress-running.json");
  const done = fixtureText("rain-progress-done.json");
  const year2025 = fixtureText("rain-imerg-late-v07-2025.json");

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("submits, waits for 100 and returns the days", async () => {
    const calls = stubService({ progress: [running, running, done], result: [year2025] });
    const onAccepted = vi.fn();
    const promise = runDailyAverageJob(job({ onAccepted }));
    await vi.runAllTimersAsync();

    expect(await promise).toHaveLength(365);
    expect(onAccepted).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([
      "POST /api/submitDataRequest/",
      "GET /api/getDataRequestProgress/",
      "GET /api/getDataRequestProgress/",
      "GET /api/getDataRequestProgress/",
      "GET /api/getDataFromRequest/",
    ]);
  });

  it("asks again when the result is not readable right after 100", async () => {
    stubService({ progress: [done], result: [fixtureText("rain-result-not-ready.json"), year2025] });
    const promise = runDailyAverageJob(job());
    await vi.runAllTimersAsync();
    expect(await promise).toHaveLength(365);
  });

  it("fails when the result never becomes readable", async () => {
    stubService({ progress: [done], result: [fixtureText("rain-result-not-ready.json")] });
    const outcome = codeOf(runDailyAverageJob(job()));
    await vi.runAllTimersAsync();
    expect(await outcome).toBe("upstream-error");
  });

  it("fails when the service reports the job as failed", async () => {
    stubService({ progress: [running, fixtureText("rain-progress-failed.json")], result: [year2025] });
    const outcome = codeOf(runDailyAverageJob(job()));
    await vi.runAllTimersAsync();
    expect(await outcome).toBe("upstream-error");
  });

  it("gives up with a timeout when the job never finishes", async () => {
    const calls = stubService({ progress: [running], result: [year2025] });
    const outcome = codeOf(runDailyAverageJob(job({ timeoutMs: 10_000 })));
    await vi.runAllTimersAsync();
    expect(await outcome).toBe("timeout");
    expect(calls).not.toContain("GET /api/getDataFromRequest/");
  });

  it("does not even submit when the time allowed has already run out", async () => {
    const calls = stubService({ progress: [done], result: [year2025] });
    const outcome = codeOf(runDailyAverageJob(job({ notAfter: Date.now() - 1 })));
    await vi.runAllTimersAsync();
    expect(await outcome).toBe("timeout");
    expect(calls).toEqual([]);
  });

  it("abandons a job at the overall deadline even if its own timeout is longer", async () => {
    stubService({ progress: [running], result: [year2025] });
    const outcome = codeOf(runDailyAverageJob(job({ timeoutMs: 600_000, notAfter: Date.now() + 8_000 })));
    await vi.advanceTimersByTimeAsync(9_000);
    expect(await outcome).toBe("timeout");
  });

  it("stops while waiting when the signal aborts", async () => {
    const calls = stubService({ progress: [running], result: [year2025] });
    const controller = new AbortController();
    const outcome = codeOf(runDailyAverageJob(job({ signal: controller.signal })));
    await vi.advanceTimersByTimeAsync(4_000);
    const callsBeforeAbort = calls.length;
    controller.abort();
    await vi.runAllTimersAsync();

    expect(await outcome).toBe("aborted");
    expect(calls).toHaveLength(callsBeforeAbort);
  });
});
