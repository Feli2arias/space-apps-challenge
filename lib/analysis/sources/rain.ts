import { SourceError } from "../errors";
import { mapWithConcurrency } from "../http";
import type {
  AnalysisSource,
  DateRange,
  RainData,
  SourceErrorCode,
  SourcePayload,
  SourceRunInput,
} from "../types";
import { createSerialGate, IMERG_LATE_DAILY_V07_DATASET_ID, runDailyAverageJob } from "./climateserv";
import { summarizeRain, type DailyRain } from "./rain-stats";

/**
 * Rain history of the area: NASA GPM IMERG "Late Run" daily accumulations,
 * read through SERVIR ClimateSERV.
 *
 * ClimateSERV is slow (about 50 s for one year of daily values, measured on
 * 2026-11-14) and processes the years of a long request one after another
 * (ClimateSERV2 `processDataRequest.start_processing`). So the period is split
 * into one request per calendar year and the requests wait side by side; a
 * year that fails is reported as missing instead of sinking the whole history.
 */

/**
 * Yearly requests waiting on the service at once: as many as the longest
 * period the product offers (10 years), so every year waits side by side.
 * Measured on 2026-11-14: ten at once all finished, each about 47 s after the
 * service accepted it, the same as a single one.
 */
const MAX_PARALLEL_JOBS = 10;

/**
 * Longest wait for one year once the service has accepted it. A year took 44
 * to 49 s from that moment in every measurement, so this is about double the
 * usual time without letting a stuck request hold the analysis.
 */
const JOB_TIMEOUT_MS = 90_000;

/**
 * Time the whole rain source may use. Ten years need about 100 s (see
 * `fetchYears`); the analysis route allows about 240 s for all sources
 * together. Requests still waiting when this runs out are reported as failed
 * years.
 */
const SOURCE_BUDGET_MS = 170_000;

export const RAIN_LIMITATIONS = {
  /** The pixel is about 10 km wide, far larger than a plot. */
  regionalPixel: "rain.regionalPixel",
  /** A satellite estimate, not a rain gauge. */
  satelliteEstimate: "rain.satelliteEstimate",
  /** The Late Run is not corrected with gauges, unlike the Final Run. */
  lateRun: "rain.lateRun",
  /** A handful of years is not a 30-year climate normal. */
  shortRecord: "rain.shortRecord",
  /** Days are UTC days, not local days. */
  utcDay: "rain.utcDay",
} as const;

export const RAIN_STAGES = {
  submitting: "submitting",
  waiting: "waiting",
  yearsDone: "years-done",
  computing: "computing",
} as const;

/**
 * One gate for the whole server, not one per analysis: two people analysing at
 * the same moment must not send their submissions together either, or the
 * service starts refusing them.
 */
const submitGate = createSerialGate();

interface YearChunk {
  readonly year: number;
  readonly range: DateRange;
}

type YearOutcome =
  | { readonly year: number; readonly ok: true; readonly days: readonly DailyRain[] }
  | { readonly year: number; readonly ok: false; readonly error: SourceError };

/** Splits the period into one inclusive range per calendar year. */
export function splitIntoYears(period: DateRange): readonly YearChunk[] {
  const startYear = Number(period.start.slice(0, 4));
  const endYear = Number(period.end.slice(0, 4));
  const chunks: YearChunk[] = [];
  for (let year = startYear; year <= endYear; year += 1) {
    chunks.push({
      year,
      range: {
        start: year === startYear ? period.start : `${year}-01-01`,
        end: year === endYear ? period.end : `${year}-12-31`,
      },
    });
  }
  return chunks;
}

function toSourceError(error: unknown): SourceError {
  if (error instanceof SourceError) return error;
  return new SourceError("unexpected", error instanceof Error ? error.message : "Unknown error", {
    cause: error,
  });
}

/**
 * Queries every year. Submissions go one at a time because the service paces
 * them itself: it accepted the first at once and each following one 6 s after
 * the previous (measured on 2026-11-14), and it answered "503 Service
 * Temporarily Unavailable" when six or more arrived together. That pacing sets
 * the total time: about 47 s for the last year plus 6 s per earlier year, so
 * roughly 60 s for 3 years, 72 s for 5 and 102 s for 10.
 * Only a cancellation rejects; any other failure costs one year.
 */
async function fetchYears(
  chunks: readonly YearChunk[],
  input: SourceRunInput,
): Promise<readonly YearOutcome[]> {
  const notAfter = Date.now() + SOURCE_BUDGET_MS;
  const total = chunks.length;
  let accepted = 0;
  let done = 0;

  const runYear = async (chunk: YearChunk): Promise<YearOutcome> => {
    try {
      const days = await runDailyAverageJob({
        datasetId: IMERG_LATE_DAILY_V07_DATASET_ID,
        start: chunk.range.start,
        end: chunk.range.end,
        polygon: input.area.polygon,
        signal: input.signal,
        timeoutMs: JOB_TIMEOUT_MS,
        notAfter,
        submitGate,
        onAccepted: () => {
          accepted += 1;
          // The service has confirmed at least one request: from here on we wait for it.
          if (accepted === 1) input.reportProgress({ stage: RAIN_STAGES.waiting, completed: done, total });
        },
      });
      done += 1;
      input.reportProgress({ stage: RAIN_STAGES.yearsDone, completed: done, total });
      return { year: chunk.year, ok: true, days };
    } catch (error) {
      const sourceError = toSourceError(error);
      if (sourceError.code === "aborted" || input.signal.aborted) throw sourceError;
      return { year: chunk.year, ok: false, error: sourceError };
    }
  };

  return mapWithConcurrency(chunks, MAX_PARALLEL_JOBS, runYear, input.signal);
}

/** The error to throw when no year could be read: the shared cause if there is one. */
function allYearsFailed(outcomes: readonly YearOutcome[]): SourceError {
  const errors = outcomes.flatMap((outcome) => (outcome.ok ? [] : [outcome.error]));
  const codes = new Set<SourceErrorCode>(errors.map((error) => error.code));
  const code: SourceErrorCode = codes.size === 1 ? errors[0].code : "upstream-error";
  const detail = errors[0]?.message ?? "No year was requested.";
  return new SourceError(code, `None of the ${outcomes.length} yearly rain requests worked. First failure: ${detail}`);
}

/** First and last day that really have a value; the requested period when none has. */
function coveredPeriod(days: readonly DailyRain[], requested: DateRange): DateRange {
  const dates = days
    .filter((day) => day.mm !== null && day.date >= requested.start && day.date <= requested.end)
    .map((day) => day.date)
    .sort();
  if (dates.length === 0) return requested;
  return { start: dates[0], end: dates[dates.length - 1] };
}

/** Builds the payload from what each yearly request returned. */
export function buildRainPayload(
  outcomes: readonly YearOutcome[],
  period: DateRange,
): SourcePayload<RainData> {
  const days = outcomes.flatMap((outcome) => (outcome.ok ? outcome.days : []));
  const failedYears = outcomes.flatMap((outcome) => (outcome.ok ? [] : [outcome.year]));
  const summary = summarizeRain(days, period, failedYears);

  return {
    status: (summary.quality.valid ?? 0) > 0 ? "ok" : "no-data",
    scope: "regional",
    period: coveredPeriod(days, period),
    metrics: summary.metrics,
    data: summary.data,
    quality: summary.quality,
    limitations: Object.values(RAIN_LIMITATIONS),
    // ClimateSERV already serves millimetres per day, so nothing is converted here.
    conversions: [],
    // A year that failed may work on the next try, so this answer must not be kept.
    incomplete: failedYears.length > 0,
  };
}

async function run(input: SourceRunInput): Promise<SourcePayload<RainData>> {
  const chunks = splitIntoYears(input.period);
  if (chunks.length === 0) {
    throw new SourceError("unexpected", `The period ${input.period.start} to ${input.period.end} is empty.`, {
      retryable: false,
    });
  }

  input.reportProgress({ stage: RAIN_STAGES.submitting, completed: 0, total: chunks.length });
  const outcomes = await fetchYears(chunks, input);
  if (!outcomes.some((outcome) => outcome.ok)) throw allYearsFailed(outcomes);

  input.reportProgress({ stage: RAIN_STAGES.computing });
  return buildRainPayload(outcomes, input.period);
}

export const rainSource: AnalysisSource<"rain"> = {
  id: "rain",
  product: {
    // The name ClimateSERV gives this series in its own catalogue.
    id: "nasa-imerg-late_global_0.1deg_1dy_v7",
    name: "GPM IMERG Late Run, 1-day precipitation accumulation",
    version: "V07",
    provider: "NASA GPM",
    accessedVia: "SERVIR ClimateSERV",
    documentationUrl: "https://gpm.nasa.gov/data/imerg",
    // 0.1 degrees of latitude: about 11 km.
    spatialResolutionMeters: 11_000,
    temporalResolution: "daily",
  },
  cacheVersion: 2,
  isStatic: false,
  // Past calendar years of the Late Run do not change from day to day: keep them a week.
  cacheTtlSeconds: 7 * 24 * 60 * 60,
  run,
};
