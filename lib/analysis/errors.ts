import type { SourceErrorCode, SourceErrorInfo } from "./types";

const RETRYABLE: ReadonlySet<SourceErrorCode> = new Set<SourceErrorCode>([
  "timeout",
  "network",
  "rate-limited",
  "upstream-error",
  "unexpected",
]);

/**
 * The one error type data sources throw. It carries a code the interface can
 * translate and a technical detail for the logs; it never carries secrets.
 */
export class SourceError extends Error {
  readonly code: SourceErrorCode;
  readonly retryable: boolean;
  /** HTTP status of the upstream answer, when there was one. */
  readonly status: number | null;

  constructor(
    code: SourceErrorCode,
    detail: string,
    options: { readonly status?: number; readonly retryable?: boolean; readonly cause?: unknown } = {},
  ) {
    super(detail, { cause: options.cause });
    this.name = "SourceError";
    this.code = code;
    this.status = options.status ?? null;
    this.retryable = options.retryable ?? RETRYABLE.has(code);
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Turns anything thrown into the error shape the API returns. */
export function toSourceErrorInfo(error: unknown): SourceErrorInfo {
  if (error instanceof SourceError) {
    return { code: error.code, detail: error.message, retryable: error.retryable };
  }
  if (isAbortError(error)) {
    return { code: "aborted", detail: "The request was cancelled.", retryable: false };
  }
  // The original message could describe internals, so it is not sent to the browser.
  return { code: "unexpected", detail: "The source stopped with an unexpected error.", retryable: true };
}
