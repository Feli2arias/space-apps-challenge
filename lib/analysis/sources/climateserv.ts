import { z } from "zod";

import { SourceError } from "../errors";
import { requestJson } from "../http";
import type { PolygonGeometry } from "../types";
import type { DailyRain } from "./rain-stats";

/**
 * Client of SERVIR ClimateSERV, the service that holds NASA's IMERG rainfall
 * as daily series. It mirrors SERVIR's own Python client
 * (github.com/SERVIR/ClimateSERVpy, `climateserv/api.py`) and was checked
 * against the server's source (github.com/SERVIR/ClimateSERV2) and real calls.
 *
 * The service works with jobs: submit a request, ask for its progress until it
 * reaches 100, then fetch the result. No key or account is needed.
 */

const BASE_URL = "https://climateserv.servirglobal.net/api";

/**
 * ClimateSERV's number for "NASA-IMERG-V07-Late 1 Day", as published in its own
 * layer catalogue (https://climateserv.servirglobal.net/get-layers, `api_id`).
 * The number 26 in the ClimateSERVpy README is the older V06 series, which
 * stops on 2024-06-01 on this service.
 */
export const IMERG_LATE_DAILY_V07_DATASET_ID = 226;

/** `intervaltype` for one value per day (the only one the official client sends). */
const INTERVAL_DAILY = 0;

/** `operationtype` for the average over the geometry (`getParameterTypes/`: 5 = "avg"). */
const OPERATION_AVERAGE = 5;

/** Progress value that means the job has finished. */
const PROGRESS_DONE = 100;

/** Progress value the service reports when a job failed or its id is unknown. */
const PROGRESS_FAILED = -1;

/**
 * The server writes -9999 where the average is not a number
 * (ClimateSERV2 `TDSExtraction.get_data_values`: `ds_vals[np.isnan(ds_vals)] = -9999`).
 */
export const MISSING_VALUE = -9999;

/** Pause between two progress checks of the same job. */
const POLL_INTERVAL_MS = 2_500;

/** Each call is a small JSON exchange; if it takes longer than this the service is stuck. */
const CALL_TIMEOUT_MS = 20_000;

/**
 * The progress can reach 100 a moment before the result file is readable (the
 * server then answers `{"errMsg": "… No such file or directory …"}`), so the
 * result is asked for a few times before giving up.
 */
const RESULT_ATTEMPTS = 4;

const UUID_PATTERN = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** `["<job id>"]` on success; a list of error sentences, or an id plus a remark, otherwise. */
const submitSchema = z.array(z.string()).min(1);

const progressSchema = z.tuple([z.number()]);

const dayRowSchema = z.object({
  /** MM/DD/YYYY */
  date: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  value: z.object({ avg: z.number() }),
});

const resultSchema = z.union([
  z.object({ data: z.array(dayRowSchema) }),
  z.object({ errMsg: z.string() }),
]);

export interface DailyAverageJob {
  readonly datasetId: number;
  /** Inclusive dates, YYYY-MM-DD. */
  readonly start: string;
  readonly end: string;
  readonly polygon: PolygonGeometry;
  readonly signal: AbortSignal;
  /** Gives up on the job after this long, counted from the moment the service accepts it. */
  readonly timeoutMs: number;
  /** Absolute time (ms since 1970) after which the job is abandoned whatever its state. */
  readonly notAfter?: number;
  /** Runs the submission; pass `createSerialGate()` to send submissions one at a time. */
  readonly submitGate?: Gate;
  /** Called once, as soon as the service has accepted the job. */
  readonly onAccepted?: () => void;
}

/** Decides when a task may run. */
export type Gate = <T>(task: () => Promise<T>) => Promise<T>;

/**
 * A gate that lets one task through at a time, in the order they arrive.
 * A task that fails does not block the ones behind it.
 */
export function createSerialGate(): Gate {
  let last: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const result = last.then(task);
    last = result.catch(() => undefined);
    return result;
  };
}

function aborted(): SourceError {
  return new SourceError("aborted", "The request was cancelled.");
}

/** Waits `ms`, or rejects at once if the signal aborts. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(aborted());
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(aborted());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** YYYY-MM-DD → MM/DD/YYYY, the format the service expects. */
export function toServiceDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${month}/${day}/${year}`;
}

/** MM/DD/YYYY → YYYY-MM-DD. */
function fromServiceDate(serviceDate: string): string {
  const [month, day, year] = serviceDate.split("/");
  return `${year}-${month}-${day}`;
}

/** The address of a job submission. All parameters travel in the query string, as in the official client. */
export function buildSubmitUrl(job: Pick<DailyAverageJob, "datasetId" | "start" | "end" | "polygon">): string {
  const query = new URLSearchParams({
    datatype: String(job.datasetId),
    begintime: toServiceDate(job.start),
    endtime: toServiceDate(job.end),
    intervaltype: String(INTERVAL_DAILY),
    operationtype: String(OPERATION_AVERAGE),
    geometry: JSON.stringify({ type: job.polygon.type, coordinates: job.polygon.coordinates }),
  });
  return `${BASE_URL}/submitDataRequest/?${query.toString()}`;
}

/** Reads the answer to a submission and returns the job id. */
export function parseSubmitResponse(raw: unknown): string {
  const parsed = submitSchema.safeParse(raw);
  if (!parsed.success) {
    throw new SourceError("bad-response", "ClimateSERV did not return a job id.");
  }
  const [first, ...rest] = parsed.data;
  if (!UUID_PATTERN.test(first) || rest.length > 0) {
    // The service explains refusals in plain sentences, e.g. "Max date range is: 20 years".
    const reason = (UUID_PATTERN.test(first) ? rest : parsed.data).join("; ").slice(0, 200);
    throw new SourceError("upstream-error", `ClimateSERV refused the request: ${reason}`, {
      retryable: false,
    });
  }
  return first;
}

export function parseProgressResponse(raw: unknown): number {
  const parsed = progressSchema.safeParse(raw);
  if (!parsed.success) {
    throw new SourceError("bad-response", "ClimateSERV returned an unreadable job progress.");
  }
  return parsed.data[0];
}

/**
 * Reads the result of a finished job. Returns `null` when the service says the
 * result is not readable yet. Values come in millimetres per day: ClimateSERV
 * already divides the 0.1 mm integers of the IMERG files by 10 when it loads
 * them (ClimateSERV2 `etl_dataset_subtype_imerg.py`: `da = da / 10.0`,
 * `units: mm`), so no scale factor is applied here.
 */
export function parseDailyAverageResponse(raw: unknown): readonly DailyRain[] | null {
  const parsed = resultSchema.safeParse(raw);
  if (!parsed.success) {
    throw new SourceError("bad-response", "ClimateSERV returned a result in an unknown shape.");
  }
  if ("errMsg" in parsed.data) return null;

  return parsed.data.data
    .map((row) => ({
      date: fromServiceDate(row.date),
      // Rain cannot be negative: the missing marker, or any other negative, is "no value".
      mm: row.value.avg < 0 ? null : row.value.avg,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function submitJob(job: DailyAverageJob): Promise<string> {
  // Checked here, not before the gate: a job can wait a while for its turn to be submitted.
  if (job.signal.aborted) throw aborted();
  if (job.notAfter !== undefined && Date.now() >= job.notAfter) {
    throw new SourceError("timeout", `No time left to request ${job.start} to ${job.end}.`);
  }
  const raw = await requestJson(buildSubmitUrl(job), {
    method: "POST",
    timeoutMs: CALL_TIMEOUT_MS,
    signal: job.signal,
  });
  return parseSubmitResponse(raw);
}

async function waitUntilDone(jobId: string, deadline: number, job: DailyAverageJob): Promise<void> {
  const url = `${BASE_URL}/getDataRequestProgress/?id=${encodeURIComponent(jobId)}`;
  for (;;) {
    const raw = await requestJson(url, { timeoutMs: CALL_TIMEOUT_MS, signal: job.signal });
    const progress = parseProgressResponse(raw);
    if (progress >= PROGRESS_DONE) return;
    if (progress <= PROGRESS_FAILED) {
      throw new SourceError("upstream-error", `ClimateSERV could not process ${job.start} to ${job.end}.`);
    }
    if (Date.now() + POLL_INTERVAL_MS > deadline) {
      throw new SourceError(
        "timeout",
        `ClimateSERV did not finish ${job.start} to ${job.end} in time (progress ${progress}%).`,
      );
    }
    await sleep(POLL_INTERVAL_MS, job.signal);
  }
}

async function fetchResult(jobId: string, job: DailyAverageJob): Promise<readonly DailyRain[]> {
  const url = `${BASE_URL}/getDataFromRequest/?id=${encodeURIComponent(jobId)}`;
  for (let attempt = 1; attempt <= RESULT_ATTEMPTS; attempt += 1) {
    const raw = await requestJson(url, { timeoutMs: CALL_TIMEOUT_MS, signal: job.signal });
    const days = parseDailyAverageResponse(raw);
    if (days !== null) return days;
    if (attempt < RESULT_ATTEMPTS) await sleep(POLL_INTERVAL_MS, job.signal);
  }
  throw new SourceError("upstream-error", `ClimateSERV finished ${job.start} to ${job.end} but its result is not readable.`);
}

/**
 * Runs one job from submission to result: the average over the polygon for
 * every day between `start` and `end` that the service has, oldest first.
 * Days the service does not hold are simply absent from the answer.
 */
export async function runDailyAverageJob(job: DailyAverageJob): Promise<readonly DailyRain[]> {
  const jobId = await (job.submitGate ? job.submitGate(() => submitJob(job)) : submitJob(job));
  job.onAccepted?.();
  const deadline = Math.min(Date.now() + job.timeoutMs, job.notAfter ?? Number.POSITIVE_INFINITY);
  await waitUntilDone(jobId, deadline, job);
  return fetchResult(jobId, job);
}
