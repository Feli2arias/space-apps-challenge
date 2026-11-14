import { describe, expect, it } from "vitest";
import { AI_DICTIONARY } from "./ai";

/** Every text in a dictionary, with the path that leads to it. */
function leaves(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => leaves(item, `${path}[${index}]`));
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key));
  }
  return [];
}

describe("AI_DICTIONARY", () => {
  it("has the same entries, all filled in, in both languages", () => {
    const es = leaves(AI_DICTIONARY.es);
    const en = leaves(AI_DICTIONARY.en);
    expect(en.map(([path]) => path)).toEqual(es.map(([path]) => path));
    for (const [, text] of [...es, ...en]) expect(text.trim()).not.toBe("");
  });

  it("keeps the placeholders", () => {
    for (const dict of Object.values(AI_DICTIONARY)) {
      expect(dict.reading.basis).toContain("{count}");
      expect(dict.chat.remaining).toContain("{left}");
    }
  });
});
