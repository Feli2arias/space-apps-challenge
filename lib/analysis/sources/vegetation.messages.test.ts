import { describe, expect, it } from "vitest";

import type { SourceMessages } from "../types";
import {
  VEGETATION_CONVERSION,
  VEGETATION_LIMITATION,
  VEGETATION_METRIC,
  VEGETATION_QUALITY_NOTE,
  VEGETATION_STAGE,
} from "./landsat-codes";
import { LOW_VEGETATION_NDVI, MIN_CLEAR_FRACTION } from "./landsat-series";
import { MAX_HISTORY_MONTHS, vegetationSource } from "./vegetation";
import { vegetationMessages } from "./vegetation.messages";

const LOCALES = ["es", "en"] as const;

/** Every piece of text of a catalogue, to scan for words that must not appear. */
function allText(messages: SourceMessages): string {
  return [
    messages.title,
    messages.summary,
    messages.noData,
    ...Object.values(messages.scope),
    ...Object.values(messages.metrics).flatMap((metric) => [metric.label, metric.help]),
    ...Object.values(messages.limitations),
    ...Object.values(messages.qualityNotes),
    ...Object.values(messages.conversions),
    ...Object.values(messages.stages),
  ].join("\n");
}

describe.each(LOCALES)("vegetation messages (%s)", (locale) => {
  const messages = vegetationMessages[locale];

  it("has words for every code the source can emit, and nothing else", () => {
    expect(Object.keys(messages.metrics).sort()).toEqual(Object.values(VEGETATION_METRIC).sort());
    expect(Object.keys(messages.limitations).sort()).toEqual(Object.values(VEGETATION_LIMITATION).sort());
    expect(Object.keys(messages.qualityNotes).sort()).toEqual(Object.values(VEGETATION_QUALITY_NOTE).sort());
    expect(Object.keys(messages.conversions).sort()).toEqual(Object.values(VEGETATION_CONVERSION).sort());
    expect(Object.keys(messages.stages).sort()).toEqual(Object.values(VEGETATION_STAGE).sort());
  });

  it("describes both scopes the source can return", () => {
    expect(Object.keys(messages.scope).sort()).toEqual(["parcel", "pixel"]);
  });

  it("leaves no text empty", () => {
    const texts = allText(messages).split("\n");
    expect(texts.every((text) => text.trim().length > 0)).toBe(true);
  });

  it("repeats the numbers the code really uses", () => {
    const { spatialResolutionMeters } = vegetationSource.product;
    expect(messages.limitations[VEGETATION_LIMITATION.thresholdIsConvention]).toContain(String(LOW_VEGETATION_NDVI));
    expect(messages.metrics[VEGETATION_METRIC.lowVegetationShare].help).toContain(String(LOW_VEGETATION_NDVI));
    expect(messages.metrics[VEGETATION_METRIC.usableObservations].help).toContain(`${MIN_CLEAR_FRACTION * 100} %`);
    expect(messages.limitations[VEGETATION_LIMITATION.periodCapped]).toContain(String(MAX_HISTORY_MONTHS));
    expect(messages.limitations[VEGETATION_LIMITATION.singlePixel]).toContain(`${spatialResolutionMeters} m`);
    expect(messages.limitations[VEGETATION_LIMITATION.singlePixel]).toContain(`${spatialResolutionMeters ** 2} m²`);
    expect(messages.scope.parcel).toContain(`${spatialResolutionMeters} m`);
  });

  it("describes a low NDVI only as compatible with little or no vegetation", () => {
    const expected = locale === "es" ? "compatible con poca o ninguna vegetación" : "compatible with little or no vegetation";
    expect(messages.limitations[VEGETATION_LIMITATION.thresholdIsConvention]).toContain(expected);
    expect(messages.metrics[VEGETATION_METRIC.lowVegetationShare].help).toContain(expected);
  });

  it("never says the satellite detects something", () => {
    expect(allText(messages)).not.toMatch(/detect/i);
  });
});
