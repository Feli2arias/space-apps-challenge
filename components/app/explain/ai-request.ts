import type { ApiResponse } from "@/lib/analysis/types";

/** How a request to the language-model routes can end, as the screen explains it. */
export type AiErrorKind = "failed" | "notReady" | "rateLimited";

export type AiResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: AiErrorKind };

const AVAILABILITY_ENDPOINT = "/api/recommend";

function errorKindFor(status: number): AiErrorKind {
  if (status === 409) return "notReady";
  if (status === 429) return "rateLimited";
  return "failed";
}

/** True when the server has a key for the language model. Any failure counts as "no". */
export async function isAiAvailable(signal: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(AVAILABILITY_ENDPOINT, { signal });
    const body = (await response.json()) as ApiResponse<{ available: boolean }>;
    return body.success && body.data.available;
  } catch {
    return false;
  }
}

/** Sends a body to one of the routes. Never throws, except when `signal` aborts. */
export async function postAi<T>(endpoint: string, body: unknown, signal: AbortSignal): Promise<AiResult<T>> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    const parsed = (await response.json()) as ApiResponse<T>;
    return parsed.success
      ? { ok: true, data: parsed.data }
      : { ok: false, error: errorKindFor(response.status) };
  } catch (error) {
    if (signal.aborted) throw error;
    return { ok: false, error: "failed" };
  }
}
