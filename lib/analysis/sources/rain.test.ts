import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SourceError } from "../errors";
import { bufferArea } from "../geometry";
import type { SourceProgress, SourceRunInput } from "../types";
import { parseDailyAverageResponse } from "./climateserv";
import { RAIN_QUALITY_NOTES } from "./rain-stats";
import { buildRainPayload, RAIN_LIMITATIONS, rainSource, splitIntoYears } from "./rain";

/** Real ClimateSERV answers for the 200 m test square in Los Chiles, captured on 2026-11-14. */
function fixtureText(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8");
}

const YEAR_FIXTURES: Readonly<Record<string, string>> = {
  "2024": fixtureText("rain-imerg-late-v07-2024.json"),
  "2025": fixtureText("rain-imerg-late-v07-2025.json"),
};

/** The job id the service really gave each captured year. */
function jobIdOf(year: string): string {
  return (JSON.parse(YEAR_FIXTURES[year]) as { uid: string }).uid;
}

function daysOf(year: string) {
  return parseDailyAverageResponse(JSON.parse(YEAR_FIXTURES[year]) as unknown) ?? [];
}

const testArea = bufferArea({ lat: 10.95, lon: -84.72 }, 200);

describe("splitIntoYears", () => {
  it("gives one inclusive range per calendar year", () => {
    expect(splitIntoYears({ start: "2023-01-01", end: "2025-12-31" })).toEqual([
      { year: 2023, range: { start: "2023-01-01", end: "2023-12-31" } },
      { year: 2024, range: { start: "2024-01-01", end: "2024-12-31" } },
      { year: 2025, range: { start: "2025-01-01", end: "2025-12-31" } },
    ]);
  });

  it("keeps the first and last year clipped to the period", () => {
    expect(splitIntoYears({ start: "2024-03-15", end: "2025-02-10" })).toEqual([
      { year: 2024, range: { start: "2024-03-15", end: "2024-12-31" } },
      { year: 2025, range: { start: "2025-01-01", end: "2025-02-10" } },
    ]);
  });

  it("returns nothing for a period that ends before it starts", () => {
    expect(splitIntoYears({ start: "2025-01-01", end: "2024-12-31" })).toEqual([]);
  });
});

describe("buildRainPayload", () => {
  const period = { start: "2024-01-01", end: "2025-12-31" };

  it("returns the years that worked and flags the one that failed", () => {
    const payload = buildRainPayload(
      [
        { year: 2024, ok: false, error: new SourceError("timeout", "too slow") },
        { year: 2025, ok: true, days: daysOf("2025") },
      ],
      period,
    );
    expect(payload.status).toBe("ok");
    expect(payload.scope).toBe("regional");
    expect(payload.period).toEqual({ start: "2025-01-01", end: "2025-12-31" });
    expect(payload.quality).toMatchObject({ expected: 731, valid: 365 });
    expect(payload.quality.notes).toContain(RAIN_QUALITY_NOTES.yearsFailed);
    expect(payload.quality.notes).not.toContain(RAIN_QUALITY_NOTES.missingDays);
    expect(payload.data.annual[0]).toMatchObject({ year: 2024, totalMm: null, complete: false });
    expect(payload.limitations).toEqual(Object.values(RAIN_LIMITATIONS));
    expect(payload.conversions).toEqual([]);
  });

  it("answers no-data when the service worked but has no day for the period", () => {
    const payload = buildRainPayload(
      [
        { year: 2024, ok: true, days: [] },
        { year: 2025, ok: true, days: [] },
      ],
      period,
    );
    expect(payload.status).toBe("no-data");
    expect(payload.period).toEqual(period);
    expect(payload.quality).toMatchObject({ expected: 731, valid: 0, coverage: 0 });
    expect(payload.data.climatology).toHaveLength(12);
  });
});

describe("rainSource.run", () => {
  /**
   * Plays the service back from the captured answers. `failingYears` are
   * reported as failed jobs, the way the service does it (progress -1).
   */
  function stubService(failingYears: readonly string[] = []): void {
    vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const url = new URL(String(input));
      if (url.pathname.endsWith("/submitDataRequest/")) {
        const year = (url.searchParams.get("begintime") ?? "").slice(-4);
        return new Response(JSON.stringify([jobIdOf(year)]));
      }
      const year = Object.keys(YEAR_FIXTURES).find((key) => jobIdOf(key) === url.searchParams.get("id")) ?? "";
      if (url.pathname.endsWith("/getDataRequestProgress/")) {
        const name = failingYears.includes(year) ? "rain-progress-failed.json" : "rain-progress-done.json";
        return new Response(fixtureText(name));
      }
      return new Response(YEAR_FIXTURES[year]);
    });
  }

  function input(signal: AbortSignal, progress: SourceProgress[]): SourceRunInput {
    return {
      area: testArea,
      period: { start: "2024-01-01", end: "2025-12-31" },
      signal,
      reportProgress: (step) => progress.push(step),
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reports each confirmed step and returns the history", async () => {
    stubService();
    const progress: SourceProgress[] = [];
    const promise = rainSource.run(input(new AbortController().signal, progress));
    await vi.runAllTimersAsync();
    const payload = await promise;

    expect(progress).toEqual([
      { stage: "submitting", completed: 0, total: 2 },
      { stage: "waiting", completed: 0, total: 2 },
      { stage: "years-done", completed: 1, total: 2 },
      { stage: "years-done", completed: 2, total: 2 },
      { stage: "computing" },
    ]);
    expect(payload.status).toBe("ok");
    expect(payload.data.annual.map((year) => year.totalMm)).toEqual([2352.3, 2647.9]);
    expect(payload.quality.notes).toContain(RAIN_QUALITY_NOTES.missingDays);
  });

  it("keeps the years that worked when one fails", async () => {
    stubService(["2024"]);
    const progress: SourceProgress[] = [];
    const promise = rainSource.run(input(new AbortController().signal, progress));
    await vi.runAllTimersAsync();
    const payload = await promise;

    expect(payload.status).toBe("ok");
    expect(payload.quality.notes).toContain(RAIN_QUALITY_NOTES.yearsFailed);
    expect(progress.filter((step) => step.stage === "years-done")).toEqual([
      { stage: "years-done", completed: 1, total: 2 },
    ]);
  });

  it("throws a SourceError when no year works", async () => {
    stubService(["2024", "2025"]);
    const outcome = rainSource.run(input(new AbortController().signal, [])).catch((error: unknown) => error);
    await vi.runAllTimersAsync();
    const error = await outcome;

    expect(error).toBeInstanceOf(SourceError);
    expect((error as SourceError).code).toBe("upstream-error");
  });

  it("stops with 'aborted' when the signal is already cancelled", async () => {
    stubService();
    const controller = new AbortController();
    controller.abort();
    const outcome = rainSource.run(input(controller.signal, [])).catch((error: unknown) => error);
    await vi.runAllTimersAsync();
    const error = await outcome;

    expect(error).toBeInstanceOf(SourceError);
    expect((error as SourceError).code).toBe("aborted");
  });
});
