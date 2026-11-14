import { describe, expect, it } from "vitest";
import { isSearchableQuery, searchPlaces } from "./geocode-client";

/**
 * Answer of GET /api/geocode?q=Los%20Chiles&lang=es, captured from the running
 * backend on 2026-11-14.
 */
const LOS_CHILES_ANSWER = {
  success: true,
  data: {
    query: "Los Chiles",
    results: [
      {
        name: "Los Chiles",
        displayName: "Los Chiles, Alajuela, Costa Rica",
        lat: 10.8570354,
        lon: -84.7150178,
        kind: "county",
      },
      {
        name: "Los Chiles",
        displayName: "Los Chiles, Alajuela, 21401, Costa Rica",
        lat: 11.0334758,
        lon: -84.7153035,
        kind: "town",
      },
    ],
    attribution: "© OpenStreetMap contributors (ODbL)",
    fromCache: false,
  },
  error: null,
};

/** Answer of GET /api/geocode?q=&lang=es, captured the same day (status 400). */
const TOO_SHORT_ANSWER = {
  success: false,
  data: null,
  error: {
    code: "invalid-request",
    message: "Write at least two letters of the place you are looking for.",
    issues: [{ path: "q", message: "Too small: expected string to have >=2 characters" }],
  },
};

function fakeFetch(answer: Response | Error) {
  const urls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    urls.push(String(input));
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { fetchImpl, urls };
}

async function search(answer: Response | Error, controller = new AbortController()) {
  const { fetchImpl, urls } = fakeFetch(answer);
  const outcome = await searchPlaces("  Los Chiles ", "es", { signal: controller.signal, fetchImpl });
  return { outcome, urls };
}

describe("searchPlaces", () => {
  it("sends the trimmed query and the language", async () => {
    const { urls } = await search(Response.json(LOS_CHILES_ANSWER));
    expect(urls).toEqual(["/api/geocode?q=Los+Chiles&lang=es"]);
  });

  it("returns the places and the attribution to show", async () => {
    const { outcome } = await search(Response.json(LOS_CHILES_ANSWER));
    expect(outcome).toEqual({
      kind: "found",
      places: LOS_CHILES_ANSWER.data.results,
      attribution: "© OpenStreetMap contributors (ODbL)",
    });
  });

  it("returns an empty list when nothing matches", async () => {
    const empty = { ...LOS_CHILES_ANSWER, data: { ...LOS_CHILES_ANSWER.data, results: [] } };
    const { outcome } = await search(Response.json(empty));
    expect(outcome).toMatchObject({ kind: "found", places: [] });
  });

  it("reads a refusal", async () => {
    const { outcome } = await search(Response.json(TOO_SHORT_ANSWER, { status: 400 }));
    expect(outcome).toEqual({
      kind: "rejected",
      status: 400,
      error: TOO_SHORT_ANSWER.error,
      retryAfterSeconds: null,
    });
  });

  it("reads how long to wait after too many searches", async () => {
    const body = { success: false, data: null, error: { code: "rate-limited", message: "Too many searches." } };
    const { outcome } = await search(Response.json(body, { status: 429, headers: { "retry-after": "17" } }));
    expect(outcome).toMatchObject({ kind: "rejected", status: 429, retryAfterSeconds: 17 });
  });

  it("refuses places with coordinates that cannot exist", async () => {
    const broken = {
      ...LOS_CHILES_ANSWER,
      data: { ...LOS_CHILES_ANSWER.data, results: [{ ...LOS_CHILES_ANSWER.data.results[0], lat: 95 }] },
    };
    expect((await search(Response.json(broken))).outcome).toEqual({ kind: "bad-response" });
  });

  it("refuses an answer that is not the expected envelope", async () => {
    expect((await search(new Response("<html></html>"))).outcome).toEqual({ kind: "bad-response" });
  });

  it("reports a network failure", async () => {
    expect((await search(new TypeError("Failed to fetch"))).outcome).toEqual({ kind: "network" });
  });

  it("reports a cancelled search as aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const { outcome } = await search(new DOMException("Aborted", "AbortError"), controller);
    expect(outcome).toEqual({ kind: "aborted" });
  });
});

describe("isSearchableQuery", () => {
  it("needs at least two characters after trimming", () => {
    expect(isSearchableQuery("")).toBe(false);
    expect(isSearchableQuery(" a ")).toBe(false);
    expect(isSearchableQuery("Up")).toBe(true);
  });

  it("refuses a query longer than the backend accepts", () => {
    expect(isSearchableQuery("a".repeat(120))).toBe(true);
    expect(isSearchableQuery("a".repeat(121))).toBe(false);
  });
});
