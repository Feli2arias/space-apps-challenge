import { describe, expect, it } from "vitest";
import { placeholdersOf } from "./results";
import { ROTATIONS_DICTIONARY, getRotationsDictionary, joinList, type RotationsDictionary } from "./rotations";

function collectStrings(value: unknown, path: string): Array<[string, string]> {
  if (typeof value === "string") return [[path, value]];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => collectStrings(item, path ? `${path}.${key}` : key));
  }
  return [];
}

const { es, en } = ROTATIONS_DICTIONARY;

/** `locale` differs between languages by design. */
function texts(dict: RotationsDictionary): Array<[string, string]> {
  return collectStrings(dict, "").filter(([path]) => path !== "locale");
}

describe("rotations dictionary", () => {
  it("has the same keys in both languages", () => {
    const paths = (dict: RotationsDictionary) => texts(dict).map(([path]) => path);
    expect(paths(en)).toEqual(paths(es));
  });

  it("contains no empty strings", () => {
    expect([...texts(es), ...texts(en)].filter(([, text]) => text.trim() === "")).toEqual([]);
  });

  it("uses the same placeholders in both languages", () => {
    const english = new Map(texts(en));
    texts(es).forEach(([path, spanish]) => {
      expect([...placeholdersOf(english.get(path) ?? "")].sort(), path).toEqual([...placeholdersOf(spanish)].sort());
    });
  });

  it("gives every cover level a different letter within a language", () => {
    [es, en].forEach((dict) => {
      const letters = Object.values(dict.levels).map((level) => level.letter);
      expect(new Set(letters).size).toBe(letters.length);
    });
  });

  it("says the examples are not an official calendar", () => {
    expect(es.exampleWarning).toMatch(/no es un calendario oficial/);
    expect(en.exampleWarning).toMatch(/not an official calendar/);
  });

  it("falls back to Spanish for an unknown language", () => {
    expect(getRotationsDictionary("en").locale).toBe("en");
    expect(getRotationsDictionary("fr" as never).locale).toBe("es");
  });
});

describe("joinList", () => {
  it("joins with commas and a final conjunction", () => {
    expect(joinList([], es)).toBe("");
    expect(joinList(["enero"], es)).toBe("enero");
    expect(joinList(["enero", "mayo", "junio"], es)).toBe("enero, mayo y junio");
    expect(joinList(["May", "June"], en)).toBe("May and June");
  });
});
