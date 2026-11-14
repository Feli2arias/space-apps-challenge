import { describe, expect, it } from "vitest";
import type { DataScope, Metric, SourceId, SourceResult } from "@/lib/analysis/types";
import { REPORT_DICTIONARY } from "@/lib/i18n/app/report";
import { RESULTS_DICTIONARY } from "@/lib/i18n/app/results";
import type { Locale } from "@/lib/site";
import { buildReport, commonSlopeClass, wherePhrase } from "./report-sentences";

const m = (id: string, value: number | null, month?: number): Metric => ({
  id,
  value,
  unit: "count",
  aggregation: "value",
  ...(month ? { at: { month } } : {}),
});

function result(source: SourceId, metrics: readonly Metric[], extra: Partial<SourceResult<unknown>> = {}): SourceResult<unknown> {
  return {
    source,
    status: "ok",
    product: { id: "p", name: "p", version: "1", provider: "x", accessedVia: "x", spatialResolutionMeters: 1, temporalResolution: "daily", documentationUrl: "" },
    scope: "regional" as DataScope,
    period: null,
    metrics,
    data: null,
    quality: null,
    limitations: [],
    conversions: [],
    error: null,
    retrievedAt: "2026-01-01T00:00:00Z",
    fromCache: false,
    durationMs: 1,
    ...extra,
  } as SourceResult<unknown>;
}

/** Spaces of any width become plain spaces, so the expectations stay readable. */
const plain = (lines: readonly string[]) => lines.map((line) => line.replace(/[  ]/g, " "));

function report(source: SourceId, metrics: readonly Metric[], extra: Partial<SourceResult<unknown>> = {}, locale: Locale = "es") {
  return plain(
    buildReport({
      result: result(source, metrics, extra),
      areaKind: "buffer",
      locale,
      dict: REPORT_DICTIONARY[locale],
      slopeClassNames: RESULTS_DICTIONARY[locale].terrain.classes,
    }),
  );
}

describe("rain", () => {
  it("says the yearly amount, where it applies, and the wettest and driest months", () => {
    expect(report("rain", [m("rain.annualMean", 2392), m("rain.wettestMonth", 422, 7), m("rain.driestMonth", 17, 2)])).toEqual([
      "Llueve unos 2 392 mm al año en la región alrededor del terreno.",
      "El mes más lluvioso es julio y el más seco, febrero.",
    ]);
  });

  it("leaves out what is missing instead of writing a zero", () => {
    expect(report("rain", [m("rain.annualMean", null), m("rain.wettestMonth", 422, 7), m("rain.driestMonth", null)])).toEqual([
      "El mes más lluvioso es julio.",
    ]);
    expect(report("rain", [])).toEqual([]);
  });

  it("speaks English", () => {
    expect(report("rain", [m("rain.annualMean", 900), m("rain.driestMonth", 5, 1)], {}, "en")).toEqual([
      "About 900 mm of rain falls per year in the region around the plot.",
      "The driest month is January.",
    ]);
  });
});

describe("vegetation", () => {
  const scenes = [m("vegetation.scenesExamined", 320), m("vegetation.usableObservations", 41)];
  /** Days with a satellite pass, as the source reports them in its quality block. */
  const passes = { quality: { expected: 246, valid: 41, coverage: 41 / 246, notes: [] } };

  it("counts satellite passes, the same total the chart uses, and says when none had low greenness", () => {
    expect(
      report("vegetation", [...scenes, m("vegetation.lowVegetationShare", 0)], { scope: "parcel", ...passes }),
    ).toEqual([
      "De 246 pasadas del satélite revisadas dentro del cuadrado analizado, 41 mostraron el terreno sin nubes.",
      "En ninguna de ellas el verdor fue bajo.",
    ]);
  });

  it("gives only the clear passes when the total is unknown", () => {
    expect(report("vegetation", scenes, { scope: "parcel" })).toEqual([
      "41 pasadas del satélite mostraron el terreno sin nubes dentro del cuadrado analizado.",
    ]);
  });

  it("names the threshold only when the data states it", () => {
    const share = m("vegetation.lowVegetationShare", 25);
    expect(report("vegetation", [...scenes, share])).toHaveLength(1);
    expect(report("vegetation", [...scenes, share], { data: { lowVegetationThreshold: 0.2 } })[1]).toBe(
      "En el 25 % de ellas el verdor fue bajo (NDVI menor que 0,2), algo compatible con poca o ninguna vegetación.",
    );
  });

  it("says nothing about greenness when no image was clear", () => {
    expect(report("vegetation", [m("vegetation.usableObservations", 0), m("vegetation.lowVegetationShare", null)])).toEqual([
      "0 pasadas del satélite mostraron el terreno sin nubes en la región alrededor del terreno.",
    ]);
  });
});

describe("terrain", () => {
  const data = {
    slopeClasses: [
      { slopeClass: "flat", fromPercent: 0, toPercent: 2, share: 0.1 },
      { slopeClass: "moderate", fromPercent: 7, toPercent: 15, share: 0.6 },
    ],
  };

  it("joins height, slope and the most common class", () => {
    expect(
      report("terrain", [m("terrain.elevationMean", 40), m("terrain.slopeMeanPercent", 5.9)], { scope: "parcel", data }),
    ).toEqual([
      "El terreno dentro del cuadrado analizado está a unos 40 m de altura y tiene una pendiente media de 5,9 %.",
      "La clase de pendiente más frecuente es «moderado».",
    ]);
  });

  it("keeps the half it has", () => {
    expect(report("terrain", [m("terrain.slopeMeanPercent", 12)], { scope: "parcel" })).toEqual([
      "El terreno dentro del cuadrado analizado tiene una pendiente media de 12 %.",
    ]);
    expect(commonSlopeClass({ slopeClasses: [{ slopeClass: "flat", share: 0 }] })).toBeNull();
    expect(commonSlopeClass(null)).toBeNull();
  });
});

describe("soil", () => {
  it("lists the texture and calls the pH acid, neutral or alkaline by the plain rule", () => {
    expect(report("soil", [m("soil.clay", 40), m("soil.sand", 29), m("soil.silt", 31), m("soil.ph", 5.3)])).toEqual([
      "El suelo en la región alrededor del terreno tiene 40 % de arcilla, 29 % de arena y 31 % de limo.",
      "Su pH es 5,3: ácido (menos de 7).",
    ]);
    expect(report("soil", [m("soil.ph", 7)])).toEqual(["Su pH es 7,0: neutro (igual a 7)."]);
    expect(report("soil", [m("soil.ph", 8.1)], {}, "en")).toEqual(["Its pH is 8.1: alkaline (above 7)."]);
  });

  it("drops a missing texture part", () => {
    expect(report("soil", [m("soil.clay", 40), m("soil.sand", null)])).toEqual([
      "El suelo en la región alrededor del terreno tiene 40 % de arcilla.",
    ]);
  });
});

describe("climate", () => {
  it("gives the mean and the warmest and coolest months", () => {
    expect(
      report("climate", [m("climate.annualMeanTemperature", 26.4), m("climate.warmestMonth", 28.4, 4), m("climate.coolestMonth", 25.2, 12)]),
    ).toEqual([
      "La temperatura media en la región alrededor del terreno es de 26,4 °C.",
      "El mes más cálido es abril y el más fresco, diciembre.",
    ]);
  });
});

describe("buildReport", () => {
  it("writes nothing for a source that failed or had no data", () => {
    expect(report("rain", [m("rain.annualMean", 1)], { status: "error" })).toEqual([]);
    expect(report("rain", [m("rain.annualMean", 1)], { status: "no-data" })).toEqual([]);
  });

  it("names where the numbers come from", () => {
    const dict = REPORT_DICTIONARY.es;
    expect(wherePhrase("parcel", "polygon", dict)).toBe("dentro de tu parcela");
    expect(wherePhrase("pixel", "buffer", dict)).toBe("en el píxel que contiene el punto");
    expect(wherePhrase(null, "buffer", dict)).toBe("en el área consultada");
  });
});
