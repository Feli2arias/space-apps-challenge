import { describe, expect, it } from "vitest";
import { SOURCE_MESSAGES } from "@/lib/analysis/sources/messages";
import { SOURCE_IDS, type SourceMessages } from "@/lib/analysis/types";
import {
  messagesFor,
  presentText,
  resolveCode,
  resolveMetric,
  textOr,
  type SourceCatalogue,
} from "./messages";
import { SAMPLE_MESSAGES } from "./preview-messages";

const EMPTY: SourceMessages = {
  title: "",
  summary: "",
  scope: {},
  metrics: {},
  limitations: {},
  qualityNotes: {},
  conversions: {},
  stages: {},
  noData: "",
};

describe("presentText and textOr", () => {
  it("treats blank and non-text values as missing", () => {
    expect(presentText("  Lluvia ")).toBe("Lluvia");
    expect(presentText("   ")).toBeNull();
    expect(presentText(undefined)).toBeNull();
    expect(presentText(42)).toBeNull();
    expect(textOr("", "respaldo")).toBe("respaldo");
    expect(textOr("texto", "respaldo")).toBe("texto");
  });
});

describe("messagesFor", () => {
  it("returns the catalogue of a source in a language", () => {
    expect(messagesFor(SAMPLE_MESSAGES, "rain", "en")?.title).toBe("Sample: rain");
  });

  it("returns null instead of throwing when something is absent", () => {
    expect(messagesFor({}, "rain", "es")).toBeNull();
    const halfBuilt = { rain: { es: EMPTY } } as unknown as SourceCatalogue;
    expect(messagesFor(halfBuilt, "rain", "en")).toBeNull();
  });

  it("can read the real catalogue for every source and language", () => {
    SOURCE_IDS.forEach((source) => {
      expect(() => messagesFor(SOURCE_MESSAGES, source, "es")).not.toThrow();
      expect(() => messagesFor(SOURCE_MESSAGES, source, "en")).not.toThrow();
    });
  });
});

describe("resolveCode", () => {
  const table = { known: "Frase conocida.", blank: "  " };

  it("returns the sentence of a known code", () => {
    expect(resolveCode(table, "known")).toEqual({ text: "Frase conocida.", known: true });
  });

  it("falls back to the code itself when the sentence is missing or blank", () => {
    expect(resolveCode(table, "other")).toEqual({ text: "other", known: false });
    expect(resolveCode(table, "blank")).toEqual({ text: "blank", known: false });
    expect(resolveCode(undefined, "other")).toEqual({ text: "other", known: false });
  });

  it("does not mistake a code for something inherited from Object", () => {
    expect(resolveCode(table, "constructor")).toEqual({ text: "constructor", known: false });
    expect(resolveCode(table, "toString")).toEqual({ text: "toString", known: false });
    expect(resolveCode(table, "__proto__")).toEqual({ text: "__proto__", known: false });
  });
});

describe("resolveMetric", () => {
  const messages: SourceMessages = {
    ...EMPTY,
    metrics: {
      "rain.annualMean": { label: "Lluvia anual", help: "Promedio de los años completos." },
      "rain.noHelp": { label: "Sin explicación", help: "" },
    },
  };

  it("returns the label and help of a known metric", () => {
    expect(resolveMetric(messages, "rain.annualMean")).toEqual({
      label: "Lluvia anual",
      help: "Promedio de los años completos.",
      known: true,
    });
  });

  it("shows the metric id when the catalogue does not know it", () => {
    expect(resolveMetric(messages, "rain.unknown")).toEqual({
      label: "rain.unknown",
      help: null,
      known: false,
    });
    expect(resolveMetric(EMPTY, "rain.annualMean").label).toBe("rain.annualMean");
    expect(resolveMetric(null, "hasOwnProperty").label).toBe("hasOwnProperty");
  });

  it("drops a blank help sentence", () => {
    expect(resolveMetric(messages, "rain.noHelp").help).toBeNull();
  });
});
