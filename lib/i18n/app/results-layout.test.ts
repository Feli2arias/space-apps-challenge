import { describe, expect, it } from "vitest";
import { getResultsLayoutDictionary, RESULTS_LAYOUT_DICTIONARY } from "./results-layout";
import { placeholdersOf } from "./results";

function collect(value: unknown, path: string): Array<[string, string]> {
  if (typeof value === "string") return [[path, value]];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => collect(item, path ? `${path}.${key}` : key));
  }
  return [];
}

const { es, en } = RESULTS_LAYOUT_DICTIONARY;

describe("results layout dictionary", () => {
  it("has the same keys in both languages and no empty text", () => {
    expect(collect(en, "").map(([path]) => path)).toEqual(collect(es, "").map(([path]) => path));
    const empty = [...collect(es, ""), ...collect(en, "")].filter(([, text]) => text.trim() === "");
    expect(empty).toEqual([]);
  });

  it("uses the same placeholders in both languages", () => {
    const english = new Map(collect(en, ""));
    collect(es, "").forEach(([path, text]) => {
      expect(placeholdersOf(english.get(path) ?? ""), path).toEqual(placeholdersOf(text));
    });
  });

  it("names the five topics", () => {
    expect(Object.values(es.sources)).toEqual(["Lluvia", "Vegetación", "Relieve", "Suelo", "Temperatura"]);
    expect(Object.keys(en.sources)).toEqual(["rain", "vegetation", "terrain", "soil", "climate"]);
  });

  it("falls back to Spanish for an unknown language", () => {
    expect(getResultsLayoutDictionary("en")).toBe(en);
    expect(getResultsLayoutDictionary("fr" as never)).toBe(es);
  });
});
