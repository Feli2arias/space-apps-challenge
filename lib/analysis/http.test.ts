import { afterEach, describe, expect, it, vi } from "vitest";
import { SourceError } from "./errors";
import { mapWithConcurrency, request, requestJson } from "./http";

const URL_UNDER_TEST = "https://data.example.test/v1/thing";

function stubFetch(...answers: Array<Response | Error>) {
  const queue = [...answers];
  const mock = vi.fn(async (...call: [url: string, init?: RequestInit]) => {
    // The arguments are only inspected by the tests, through `mock.calls`.
    void call;
    const next = queue.shift();
    if (next === undefined) throw new Error("fetch called more often than expected");
    if (next instanceof Error) throw next;
    return next;
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

async function errorOf(promise: Promise<unknown>): Promise<SourceError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof SourceError) return error;
    throw error;
  }
  throw new Error("expected the promise to reject");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("request", () => {
  it("returns a successful response on the first try", async () => {
    const mock = stubFetch(new Response("ok"));
    const response = await request(URL_UNDER_TEST);
    expect(await response.text()).toBe("ok");
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("retries a temporary failure and then succeeds", async () => {
    vi.useFakeTimers();
    const mock = stubFetch(new Response("busy", { status: 503 }), new Response("ok"));
    const pending = request(URL_UNDER_TEST);
    await vi.runAllTimersAsync();
    expect(await (await pending).text()).toBe("ok");
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("does not retry an answer that will not change", async () => {
    const mock = stubFetch(new Response("nope", { status: 404 }));
    const error = await errorOf(request(URL_UNDER_TEST));
    expect(error.code).toBe("upstream-error");
    expect(error.status).toBe(404);
    expect(error.retryable).toBe(false);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("reports rate limiting after the retries run out", async () => {
    vi.useFakeTimers();
    const tooMany = () => new Response("slow down", { status: 429 });
    const mock = stubFetch(tooMany(), tooMany(), tooMany());
    const pending = errorOf(request(URL_UNDER_TEST));
    await vi.runAllTimersAsync();
    const error = await pending;
    expect(error.code).toBe("rate-limited");
    expect(error.retryable).toBe(true);
    expect(mock).toHaveBeenCalledTimes(3);
  });

  it("tries a few more times when the connection itself keeps failing", async () => {
    vi.useFakeTimers();
    const down = () => new TypeError("fetch failed", { cause: { code: "ECONNRESET" } });
    const mock = stubFetch(down(), down(), down(), new Response("ok"));
    const pending = request(URL_UNDER_TEST);
    await vi.runAllTimersAsync();
    expect(await (await pending).text()).toBe("ok");
    expect(mock).toHaveBeenCalledTimes(4);
  });

  it("gives up after the extra tries and names the cause", async () => {
    vi.useFakeTimers();
    const down = () => new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } });
    const mock = stubFetch(down(), down(), down(), down(), down());
    const pending = errorOf(request(URL_UNDER_TEST));
    await vi.runAllTimersAsync();
    const error = await pending;
    expect(error.code).toBe("network");
    expect(error.message).toContain("ENOTFOUND");
    expect(mock).toHaveBeenCalledTimes(5);
  });

  it("reports a network failure without leaking the full URL", async () => {
    stubFetch(new TypeError("fetch failed"));
    const error = await errorOf(request(`${URL_UNDER_TEST}?token=secret`, { retries: 0 }));
    expect(error.code).toBe("network");
    expect(error.message).toContain("data.example.test");
    expect(error.message).not.toContain("secret");
  });

  it("stops at once when the caller cancels", async () => {
    const controller = new AbortController();
    controller.abort();
    const mock = stubFetch(new DOMException("aborted", "AbortError"));
    const error = await errorOf(request(URL_UNDER_TEST, { signal: controller.signal }));
    expect(error.code).toBe("aborted");
    expect(error.retryable).toBe(false);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("sends objects as JSON", async () => {
    const mock = stubFetch(new Response("{}"));
    await request(URL_UNDER_TEST, { method: "POST", body: { a: 1 } });
    const init = mock.mock.calls[0]?.[1] ?? {};
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"a":1}');
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
  });
});

describe("requestJson", () => {
  it("parses JSON", async () => {
    stubFetch(Response.json({ elevation: 0 }));
    expect(await requestJson(URL_UNDER_TEST)).toEqual({ elevation: 0 });
  });

  it("reports a body that is not JSON", async () => {
    stubFetch(new Response("<html>maintenance</html>"));
    const error = await errorOf(requestJson(URL_UNDER_TEST));
    expect(error.code).toBe("bad-response");
  });
});

describe("mapWithConcurrency", () => {
  it("keeps the order of the results", async () => {
    const results = await mapWithConcurrency([30, 10, 20], 3, async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return ms * 2;
    });
    expect(results).toEqual([60, 20, 40]);
  });

  it("never runs more tasks at once than the limit", async () => {
    let running = 0;
    let peak = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
    });
    expect(peak).toBe(2);
  });

  it("returns an empty list for no items", async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
  });

  it("stops starting tasks after a cancel", async () => {
    const controller = new AbortController();
    const started: number[] = [];
    const pending = mapWithConcurrency(
      [1, 2, 3, 4],
      1,
      async (item) => {
        started.push(item);
        if (item === 2) controller.abort();
      },
      controller.signal,
    );
    await expect(pending).rejects.toMatchObject({ code: "aborted" });
    expect(started).toEqual([1, 2]);
  });
});
