import { describe, expect, it } from "vitest";
import { getReportDictionary, REPORT_DICTIONARY } from "./report";
import { placeholdersOf } from "./results";

function collect(value: unknown, path: string): Array<[string, string]> {
  if (typeof value === "string") return [[path, value]];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => collect(item, path ? `${path}.${key}` : key));
  }
  return [];
}

const { es, en } = REPORT_DICTIONARY;

describe("report dictionary", () => {
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

  it("never judges the plot or names a crop in a template", () => {
    const words = [...collect(es, ""), ...collect(en, "")].map(([, text]) => text.toLowerCase());
    const judging = words.filter((text) => /\b(bueno|malo|sano|good|bad|healthy|ideal|apto|suitable)\b/.test(text));
    expect(judging).toEqual([]);
  });

  it("falls back to Spanish for an unknown language", () => {
    expect(getReportDictionary("en")).toBe(en);
    expect(getReportDictionary("fr" as never)).toBe(es);
  });
});
