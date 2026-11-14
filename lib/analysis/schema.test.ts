import { describe, expect, it } from "vitest";
import { squareAround } from "./geometry";
import { parseAnalysisRequest } from "./schema";
import { ANALYSIS_LIMITS } from "./types";

const CENTER = { lat: 10.95, lon: -84.72 };
const buffer = { kind: "buffer", center: CENTER, sideMeters: 200 };

function issuesOf(input: unknown): string[] {
  const parsed = parseAnalysisRequest(input);
  return parsed.ok ? [] : parsed.issues.map((issue) => issue.path);
}

describe("parseAnalysisRequest", () => {
  it("accepts a point with a square size and builds its area", () => {
    const parsed = parseAnalysisRequest({ area: buffer, years: 5 });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.area.kind).toBe("buffer");
    expect(parsed.area.areaHectares).toBeCloseTo(4, 3);
  });

  it("accepts a drawn outline, open or already closed", () => {
    const closed = squareAround(CENTER, 300);
    const open = closed.slice(0, 4);
    expect(parseAnalysisRequest({ area: { kind: "polygon", ring: open }, years: 3 }).ok).toBe(true);
    expect(parseAnalysisRequest({ area: { kind: "polygon", ring: closed }, years: 3 }).ok).toBe(true);
  });

  it("accepts a list of sources to refresh", () => {
    expect(parseAnalysisRequest({ area: buffer, years: 5, refresh: ["rain"] }).ok).toBe(true);
  });

  it("rejects coordinates outside the globe", () => {
    expect(issuesOf({ area: { ...buffer, center: { lat: 91, lon: 0 } }, years: 5 })).toContain(
      "area.center.lat",
    );
    expect(issuesOf({ area: { ...buffer, center: { lat: 0, lon: -181 } }, years: 5 })).toContain(
      "area.center.lon",
    );
  });

  it("rejects values that are not finite numbers", () => {
    expect(issuesOf({ area: { ...buffer, center: { lat: "10.95", lon: -84.72 } }, years: 5 })).toContain(
      "area.center.lat",
    );
    expect(parseAnalysisRequest({ area: { ...buffer, center: { lat: Number.NaN, lon: 0 } }, years: 5 }).ok).toBe(
      false,
    );
  });

  it("rejects square sizes and history lengths that are not offered", () => {
    expect(issuesOf({ area: { ...buffer, sideMeters: 150 }, years: 5 })).toContain("area.sideMeters");
    expect(issuesOf({ area: buffer, years: 4 })).toContain("years");
  });

  it("rejects unknown fields and unknown sources", () => {
    expect(parseAnalysisRequest({ area: buffer, years: 5, extra: true }).ok).toBe(false);
    expect(parseAnalysisRequest({ area: buffer, years: 5, refresh: ["weather"] }).ok).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(parseAnalysisRequest(null).ok).toBe(false);
    expect(parseAnalysisRequest("area").ok).toBe(false);
    expect(parseAnalysisRequest([]).ok).toBe(false);
  });

  it("rejects an outline that crosses itself", () => {
    const [a, b, c, d] = squareAround(CENTER, 300);
    expect(issuesOf({ area: { kind: "polygon", ring: [a, c, b, d] }, years: 5 })).toContain("area.ring");
  });

  it("rejects an outline with repeated points only", () => {
    const point = [CENTER.lon, CENTER.lat];
    expect(parseAnalysisRequest({ area: { kind: "polygon", ring: [point, point, point] }, years: 5 }).ok).toBe(
      false,
    );
  });

  it("rejects areas smaller or larger than the limits", () => {
    const tiny = squareAround(CENTER, 10).slice(0, 4);
    const huge = squareAround(CENTER, 5000).slice(0, 4);
    expect(issuesOf({ area: { kind: "polygon", ring: tiny }, years: 5 })).toContain("area");
    expect(issuesOf({ area: { kind: "polygon", ring: huge }, years: 5 })).toContain("area");
  });

  it("rejects an outline with too many points", () => {
    const count = ANALYSIS_LIMITS.maxPolygonVertices + 5;
    const ring = Array.from({ length: count }, (_, index) => {
      const angle = (index / count) * 2 * Math.PI;
      return [CENTER.lon + 0.002 * Math.cos(angle), CENTER.lat + 0.002 * Math.sin(angle)];
    });
    expect(parseAnalysisRequest({ area: { kind: "polygon", ring }, years: 5 }).ok).toBe(false);
  });
});
