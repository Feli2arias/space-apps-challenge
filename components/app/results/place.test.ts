import { describe, expect, it } from "vitest";
import { parseReversePlace, placeLine, reverseUrl } from "./place";

const answer = (data: Record<string, unknown>) => ({ success: true, data, error: null });

describe("parseReversePlace", () => {
  it("reads a place and writes it as one line", () => {
    const place = parseReversePlace(
      answer({
        country: "Costa Rica",
        countryCode: "cr",
        region: "Alajuela",
        locality: "Los Chiles",
        attribution: "© OpenStreetMap",
        fromCache: true,
      }),
    );
    expect(placeLine(place)).toBe("Los Chiles, Alajuela, Costa Rica");
    expect(place?.attribution).toBe("© OpenStreetMap");
  });

  it("gives no line for open sea, and skips repeated names", () => {
    const sea = parseReversePlace(answer({ country: null, countryCode: null, region: null, locality: null, attribution: "x" }));
    expect(sea).not.toBeNull();
    expect(placeLine(sea)).toBeNull();
    expect(placeLine(parseReversePlace(answer({ locality: "Panamá", region: "Panamá", country: "Panamá" })))).toBe("Panamá");
  });

  it("treats a failure or an odd answer as no place", () => {
    expect(parseReversePlace({ success: false, data: null, error: { code: "x" } })).toBeNull();
    expect(parseReversePlace("<html>")).toBeNull();
    expect(parseReversePlace(answer({ country: 42, locality: "  " }))?.country).toBeNull();
  });
});

describe("reverseUrl", () => {
  it("builds the address only for a valid point", () => {
    expect(reverseUrl(10.95, -84.72, "es")).toBe("/api/geocode/reverse?lat=10.95&lon=-84.72&lang=es");
    expect(reverseUrl(91, 0, "en")).toBeNull();
    expect(reverseUrl(undefined, 0, "en")).toBeNull();
  });
});
