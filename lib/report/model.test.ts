import { describe, expect, it } from "vitest";
import { bufferArea } from "@/lib/analysis/geometry";
import type { RainData, SourceResult } from "@/lib/analysis/types";
import { buildPlotReport, type PlotReportInput } from "./model";
import { renderPlotReport } from "./pdf";

const area = bufferArea({ lat: 10.95, lon: -84.72 }, 200);
const period = { start: "2021-01-01", end: "2025-12-31" };

const rain: SourceResult<RainData> = {
  source: "rain",
  status: "ok",
  product: {
    id: "imerg",
    name: "GPM IMERG Late",
    version: "V07",
    provider: "NASA GPM",
    accessedVia: "SERVIR ClimateSERV",
    documentationUrl: "https://example.org",
    spatialResolutionMeters: 11000,
    temporalResolution: "daily",
  } as SourceResult["product"],
  scope: "regional",
  period,
  metrics: [
    { id: "rain.annualMean", value: 2346.4, unit: "mm/year", aggregation: "mean" },
    { id: "rain.wettestMonth", value: null, unit: "mm/month", aggregation: "max" },
  ],
  data: {
    monthly: [],
    annual: [],
    climatology: Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      meanMm: index === 1 ? null : 100 + index,
      minMm: null,
      maxMm: null,
      years: 5,
    })),
  },
  quality: null,
  limitations: [],
  conversions: [],
  error: null,
  retrievedAt: "2026-11-14T10:00:00.000Z",
  fromCache: false,
  durationMs: 1,
};

const input: PlotReportInput = {
  area,
  period,
  results: { rain },
  locale: "es",
  place: "Los Chiles, Alajuela, Costa Rica",
  reading: null,
  advice: null,
  generatedAt: new Date("2026-11-14T12:00:00.000Z"),
};

describe("buildPlotReport", () => {
  const report = buildPlotReport(input);
  const section = (heading: string) => report.sections.find((item) => item.heading === heading);

  it("identifies the plot: place, centre, area and period", () => {
    expect(report.facts.map((fact) => fact.label)).toEqual(["Lugar", "Centro del área", "Área analizada", "Período"]);
    expect(report.facts[1].value).toBe("Lat 10.95000, Lon -84.72000");
    expect(report.facts[2].value).toContain("cuadrado de 200");
  });

  it("leaves the place out when it is not known", () => {
    const withoutPlace = buildPlotReport({ ...input, place: null });
    expect(withoutPlace.facts.map((fact) => fact.label)).not.toContain("Lugar");
  });

  it("has one section per source, in the order of the screen", () => {
    expect(report.sections).toHaveLength(5);
    expect(report.sections[0].heading).toBe("Lluvia");
  });

  it("writes a missing value as missing, never as zero", () => {
    const rows = section("Lluvia")?.rows ?? [];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((row) => row.value === "sin dato")).toBe(true);
    const february = section("Lluvia")?.tables[0].rows.find((row) => row.label === "febrero");
    expect(february?.value).toBe("sin dato");
  });

  it("says what the numbers describe and where they come from", () => {
    const rainSection = section("Lluvia");
    expect(rainSection?.tag).toBe("La región, no tu parcela");
    const source = rainSection?.notes.find((note) => note.label === "Fuente");
    expect(source?.value).toContain("GPM IMERG Late V07");
    expect(source?.value).toContain("SERVIR ClimateSERV");
    expect(source?.value).toContain("14 nov 2026");
  });

  it("says plainly when a source has nothing", () => {
    const missing = report.sections.filter((item) => item.heading !== "Lluvia");
    expect(missing.every((item) => item.rows.length === 0 && item.paragraphs.length === 1)).toBe(true);
  });

  it("includes the generated texts only when they exist, marked as generated", () => {
    expect(report.ai).toEqual([]);
    expect(report.aiNote).toBeNull();

    const withAi = buildPlotReport({
      ...input,
      reading: {
        summary: "Llueve mucho en la región.",
        favorable: [{ title: "Lluvia alta", text: "Llueven 2 346 mm/año.", basedOn: ["rain"] }],
        alerts: [],
        toCheck: [],
      },
      advice: {
        recommendations: [{ title: "Revisa el drenaje", action: "Camina el terreno.", why: "Llueve mucho.", basedOn: ["rain"] }],
      },
    });
    expect(withAi.ai.map((block) => block.heading)).toEqual(["Qué dicen los datos", "Recomendaciones"]);
    expect(withAi.ai[0].groups.map((group) => group.heading)).toEqual(["A favor"]);
    expect(withAi.ai[1].groups[0].points[0].title).toBe("1. Revisa el drenaje");
    expect(withAi.aiNote).toContain("modelo de lenguaje");
  });

  it("is written in English when asked", () => {
    const english = buildPlotReport({ ...input, locale: "en" });
    expect(english.title).toBe("Plot report");
    expect(english.sections[0].heading).toBe("Rain");
  });
});

describe("renderPlotReport", () => {
  it("produces a PDF file with the report", async () => {
    const bytes = await renderPlotReport(buildPlotReport(input));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(2000);
  });
});
