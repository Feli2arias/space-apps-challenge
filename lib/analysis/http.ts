import { isAbortError, SourceError } from "./errors";

/**
 * HTTP helpers shared by every data source: a timeout on each request, a small
 * number of retries for transient failures, and errors mapped to `SourceError`.
 * Responses are returned as `unknown`; each source validates what it receives.
 */

/** Identifies the app to the open data services. It carries no personal data. */
export const USER_AGENT = "BeforeTheSeed/0.1 (NASA Space Apps 2026 prototype)";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 600;
/**
 * Extra attempts granted when the connection itself failed (no answer at all).
 * On an unstable network a kept-alive connection can go stale, and each failed
 * attempt only discards one of them, so a couple more tries often get through.
 */
const EXTRA_NETWORK_RETRIES = 2;
const RETRYABLE_STATUS: ReadonlySet<number> = new Set([408, 425, 429, 500, 502, 503, 504]);

export interface RequestOptions {
  readonly method?: "GET" | "POST";
  readonly headers?: Readonly<Record<string, string>>;
  /** Sent as JSON when it is an object, as-is when it is a string. */
  readonly body?: unknown;
  readonly timeoutMs?: number;
  /** Extra attempts after the first one. */
  readonly retries?: number;
  /** Cancels the request, including any pending retry. */
  readonly signal?: AbortSignal;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new SourceError("aborted", "The request was cancelled."));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new SourceError("aborted", "The request was cancelled."));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "unknown host";
  }
}

async function attempt(url: string, options: RequestOptions): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const isJsonBody = options.body !== undefined && typeof options.body !== "string";

  try {
    return await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        "user-agent": USER_AGENT,
        accept: "application/json",
        ...(isJsonBody ? { "content-type": "application/json" } : {}),
        ...options.headers,
      },
      body:
        options.body === undefined
          ? undefined
          : isJsonBody
            ? JSON.stringify(options.body)
            : (options.body as string),
      signal,
      cache: "no-store",
    });
  } catch (error) {
    if (options.signal?.aborted) {
      throw new SourceError("aborted", "The request was cancelled.", { cause: error });
    }
    if (timeout.aborted || isAbortError(error)) {
      throw new SourceError("timeout", `${hostOf(url)} did not answer within ${timeoutMs} ms.`, {
        cause: error,
      });
    }
    throw new SourceError("network", `Could not reach ${hostOf(url)}${causeOf(error)}.`, {
      cause: error,
    });
  }
}

/**
 * The system's short code for a failed connection (ENOTFOUND, ECONNRESET,
 * UND_ERR_SOCKET…), which tells a DNS problem from a dropped connection.
 */
function causeOf(error: unknown): string {
  const cause = error instanceof Error ? error.cause : undefined;
  const code =
    typeof cause === "object" && cause !== null && "code" in cause ? String(cause.code) : null;
  return code && /^[A-Z0-9_]{3,40}$/.test(code) ? ` (${code})` : "";
}

/**
 * Sends a request and returns the raw response when its status is 2xx.
 * Transient failures are retried with a growing delay; everything else throws.
 */
export async function request(url: string, options: RequestOptions = {}): Promise<Response> {
  const retries = options.retries ?? DEFAULT_RETRIES;
  let lastError: SourceError | null = null;
  // Grows when a try fails without any answer; see EXTRA_NETWORK_RETRIES.
  let allowed = retries;
  let networkFailures = 0;

  for (let tryNumber = 0; tryNumber <= allowed; tryNumber += 1) {
    if (tryNumber > 0) await delay(RETRY_BASE_DELAY_MS * 2 ** (tryNumber - 1), options.signal);

    try {
      const response = await attempt(url, options);
      if (response.ok) return response;

      const code = response.status === 429 ? "rate-limited" : "upstream-error";
      lastError = new SourceError(code, `${hostOf(url)} answered with status ${response.status}.`, {
        status: response.status,
        retryable: RETRYABLE_STATUS.has(response.status),
      });
      // Free the connection before retrying or giving up.
      await response.body?.cancel().catch(() => undefined);
      if (!RETRYABLE_STATUS.has(response.status)) throw lastError;
    } catch (error) {
      if (!(error instanceof SourceError)) throw error;
      if (error.code === "aborted" || !error.retryable) throw error;
      lastError = error;
      if (error.code === "network" && networkFailures < EXTRA_NETWORK_RETRIES && retries > 0) {
        networkFailures += 1;
        allowed += 1;
      }
    }
  }

  throw lastError ?? new SourceError("unexpected", `Request to ${hostOf(url)} failed.`);
}

/** Like `request`, parsed as JSON. The caller validates the shape. */
export async function requestJson(url: string, options: RequestOptions = {}): Promise<unknown> {
  const response = await request(url, options);
  try {
    return (await response.json()) as unknown;
  } catch (error) {
    throw new SourceError("bad-response", `${hostOf(url)} did not answer with valid JSON.`, {
      cause: error,
    });
  }
}

/** Like `request`, returned as bytes (for GeoTIFF and other binary answers). */
export async function requestBytes(url: string, options: RequestOptions = {}): Promise<ArrayBuffer> {
  const response = await request(url, { ...options, headers: { accept: "*/*", ...options.headers } });
  return response.arrayBuffer();
}

/**
 * Runs `task` over `items` with at most `limit` running at once, keeping the
 * order of the results. Stops starting new tasks once `signal` aborts.
 */
export async function mapWithConcurrency<TItem, TResult>(
  items: readonly TItem[],
  limit: number,
  task: (item: TItem, index: number) => Promise<TResult>,
  signal?: AbortSignal,
): Promise<TResult[]> {
  const results = new Array<TResult>(items.length);
  let next = 0;

  const worker = async (): Promise<void> => {
    while (next < items.length) {
      if (signal?.aborted) throw new SourceError("aborted", "The request was cancelled.");
      const index = next;
      next += 1;
      results[index] = await task(items[index], index);
    }
  };

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker);
  await Promise.all(workers);
  return results;
}
