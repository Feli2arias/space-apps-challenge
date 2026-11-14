import { describe, expect, it } from "vitest";
import {
  RESULTS_DICTIONARY,
  fill,
  getResultsDictionary,
  placeholdersOf,
  type ResultsDictionary,
} from "./results";

/** Collects every string in a dictionary, with the path that leads to it. */
function collectStrings(value: unknown, path: string): Array<[string, string]> {
  if (typeof value === "string") return [[path, value]];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      collectStrings(item, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

const { es, en } = RESULTS_DICTIONARY;

/** `locale` differs between languages by design, so it is left out of the comparisons. */
function texts(dict: ResultsDictionary): Array<[string, string]> {
  return collectStrings(dict, "").filter(([path]) => path !== "locale");
}

describe("results dictionary", () => {
  it("has the same keys in both languages", () => {
    const paths = (dict: ResultsDictionary) => texts(dict).map(([path]) => path);
    expect(paths(en)).toEqual(paths(es));
  });

  it("contains no empty strings", () => {
    const empty = [...texts(es), ...texts(en)].filter(([, text]) => text.trim() === "");
    expect(empty).toEqual([]);
  });

  it("uses the same placeholders in both languages", () => {
    const english = new Map(texts(en));
    texts(es).forEach(([path, spanish]) => {
      const expected = [...placeholdersOf(spanish)].sort();
      const actual = [...placeholdersOf(english.get(path) ?? "")].sort();
      expect(actual, path).toEqual(expected);
    });
  });

  it("writes missing values in words, never as a digit", () => {
    expect(es.missing).not.toMatch(/\d/);
    expect(en.missing).not.toMatch(/\d/);
  });

  it("falls back to Spanish for an unknown language", () => {
    expect(getResultsDictionary("en").locale).toBe("en");
    expect(getResultsDictionary("fr" as never).locale).toBe("es");
  });
});

describe("fill", () => {
  it("replaces every placeholder it has a value for", () => {
    expect(fill("{a} de {b}", { a: 3, b: "5" })).toBe("3 de 5");
    expect(fill("{a} y {a}", { a: "x" })).toBe("x y x");
  });

  it("leaves a placeholder visible when its value is missing", () => {
    expect(fill("{a} de {b}", { a: 3 })).toBe("3 de {b}");
  });

  it("writes zero instead of dropping it", () => {
    expect(fill("{count} escenas", { count: 0 })).toBe("0 escenas");
  });

  it("ignores names inherited from Object", () => {
    expect(fill("{toString}", {})).toBe("{toString}");
  });
});

describe("placeholdersOf", () => {
  it("lists placeholders in order", () => {
    expect(placeholdersOf("{valid} de {expected}")).toEqual(["valid", "expected"]);
    expect(placeholdersOf("sin dato")).toEqual([]);
  });
});
