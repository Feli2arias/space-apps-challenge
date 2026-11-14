import { describe, expect, it, vi } from "vitest";
import { buildRotationRequest, EXAMPLE_PLANS } from "./plans";
import { parseComparison, postRotations } from "./api";
import { ROTATIONS_BODY } from "./fixtures";

const request = buildRotationRequest(EXAMPLE_PLANS, Array(12).fill(null));

function respond(status: number, body: unknown): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("parseComparison", () => {
  it("accepts a real answer of the API", () => {
    expect(parseComparison(ROTATIONS_BODY)?.readings).toHaveLength(3);
  });

  it("rejects failures and malformed bodies", () => {
    expect(parseComparison({ success: false, data: null, error: { code: "internal" } })).toBeNull();
    expect(parseComparison({ success: true, data: { baselineId: "x", readings: [{}], study: {} } })).toBeNull();
    expect(parseComparison(null)).toBeNull();
  });
});

describe("postRotations", () => {
  it("sends the request as JSON and returns the result", async () => {
    const fetcher = respond(200, ROTATIONS_BODY);
    const outcome = await postRotations(request, new AbortController().signal, fetcher);
    expect(outcome.ok).toBe(true);
    const [url, init] = vi.mocked(fetcher).mock.calls[0];
    expect(url).toBe("/api/rotations");
    expect(JSON.parse(String(init?.body))).toEqual(request);
  });

  it("maps rate limiting, invalid input and broken answers", async () => {
    const signal = new AbortController().signal;
    expect(await postRotations(request, signal, respond(429, {}))).toEqual({ ok: false, failure: "rate-limited" });
    expect(await postRotations(request, signal, respond(400, {}))).toEqual({ ok: false, failure: "invalid" });
    expect(await postRotations(request, signal, respond(500, { success: false }))).toEqual({ ok: false, failure: "network" });
  });

  it("reports an aborted request as aborted, not as an error", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn(async () => {
      throw new DOMException("aborted", "AbortError");
    }) as unknown as typeof fetch;
    expect(await postRotations(request, controller.signal, fetcher)).toEqual({ ok: false, failure: "aborted" });
  });
});
