import { readJsonBody } from "@/lib/analysis/body";
import { getAnalysisCache } from "@/lib/analysis/cache";
import { runAnalysis } from "@/lib/analysis/orchestrator";
import { clientIdFrom, createRateLimiter } from "@/lib/analysis/rate-limit";
import { parseAnalysisRequest } from "@/lib/analysis/schema";
import { SOURCES } from "@/lib/analysis/sources";
import type { AnalysisEvent, ApiError, ApiResponse } from "@/lib/analysis/types";

/**
 * POST /api/analysis
 *
 * Receives the chosen area, validates it, queries every data source and
 * answers with newline-delimited JSON: one event per line as each source
 * starts, progresses and finishes, and a final "done" event with the whole
 * analysis. Problems found before the analysis starts (bad input, too many
 * requests) are answered with a normal JSON error instead of a stream.
 */

/** The slowest sources (rainfall jobs, Landsat scenes) can take a few minutes. */
export const maxDuration = 300;

/** A request body is a small JSON object; anything larger is refused unread. */
const MAX_BODY_BYTES = 20_000;
const REQUESTS_PER_WINDOW = 40;
const WINDOW_SECONDS = 300;

const limiter = createRateLimiter(REQUESTS_PER_WINDOW, WINDOW_SECONDS);
const encoder = new TextEncoder();

function errorResponse(status: number, error: ApiError, headers?: HeadersInit): Response {
  const body: ApiResponse<never> = { success: false, data: null, error };
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

export async function POST(request: Request): Promise<Response> {
  const limit = limiter.check(clientIdFrom(request.headers), new Date());
  if (!limit.allowed) {
    return errorResponse(
      429,
      { code: "rate-limited", message: "Too many analyses in a short time. Try again in a moment." },
      { "retry-after": String(limit.retryAfterSeconds) },
    );
  }

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return errorResponse(400, { code: "invalid-request", message: "The request body is not valid JSON." });
  }

  const parsed = parseAnalysisRequest(body.value);
  if (!parsed.ok) {
    return errorResponse(400, {
      code: "invalid-request",
      message: "The selected area is not valid.",
      issues: parsed.issues,
    });
  }

  // Stops the upstream requests when the browser disconnects or cancels.
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort(), { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const emit = (event: AnalysisEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The reader went away; there is nobody left to tell.
          open = false;
        }
      };

      try {
        await runAnalysis({
          request: parsed.request,
          area: parsed.area,
          sources: SOURCES,
          cache: getAnalysisCache(),
          signal: abort.signal,
          emit,
          now: () => new Date(),
        });
      } catch {
        // Sources report their own failures; reaching here means a bug in the engine.
        emit({
          type: "fatal",
          error: { code: "internal", message: "The analysis could not be completed." },
        });
      } finally {
        if (open) controller.close();
        open = false;
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, no-transform",
      // Asks reverse proxies not to hold the stream back.
      "x-accel-buffering": "no",
    },
  });
}
