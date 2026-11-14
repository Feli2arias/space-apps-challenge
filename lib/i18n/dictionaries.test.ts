import { describe, expect, it } from "vitest";
import { en } from "./en";
import { es } from "./es";
import type { Dictionary } from "./types";

const DICTIONARIES: readonly Dictionary[] = [es, en];

/** Collects every string in a dictionary, with the path that leads to it. */
function collectStrings(value: unknown, path: string): Array<[string, string]> {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectStrings(item, `${path}[${index}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      collectStrings(item, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

describe("dictionaries", () => {
  it("have the same shape in both languages", () => {
    const paths = (dict: Dictionary) => collectStrings(dict, "").map(([path]) => path);
    expect(paths(en)).toEqual(paths(es));
  });

  it("contain no empty strings", () => {
    DICTIONARIES.forEach((dict) => {
      const empty = collectStrings(dict, dict.locale).filter(([, text]) => text.trim() === "");
      expect(empty).toEqual([]);
    });
  });

  it("show the same figures in both languages", () => {
    const values = (dict: Dictionary) =>
      dict.analyses.items.map((item) => item.bars.map((bar) => bar.value));
    expect(values(en)).toEqual(values(es));

    const resolutions = (dict: Dictionary) => dict.data.rows.map((row) => row.resolution);
    expect(resolutions(en)).toEqual(resolutions(es));

    const stats = (dict: Dictionary) => dict.stats.items.map((stat) => stat.value);
    expect(stats(en)).toEqual(stats(es));
  });

  it("write each bar value the way its number reads", () => {
    DICTIONARIES.forEach((dict) => {
      dict.analyses.items.forEach((item) => {
        item.bars.forEach((bar) => {
          const written = Number.parseFloat(bar.display.replace(",", "."));
          expect(written).toBe(bar.value);
        });
      });
    });
  });

  it("point each language at the other one", () => {
    expect(es.nav.otherLocale).toBe("en");
    expect(en.nav.otherLocale).toBe("es");
  });

  it("compare three rotations, with the current practice first", () => {
    DICTIONARIES.forEach((dict) => {
      expect(dict.rotations.cards).toHaveLength(3);
      expect(dict.rotations.cards[0].badge).not.toBeNull();
      dict.rotations.cards.forEach((card) => {
        expect(card.sequence.at(-1)?.kind).toBe("target");
      });
    });
  });

  it("use unique labels where they double as list keys", () => {
    const unique = (items: readonly string[]) => new Set(items).size === items.length;
    DICTIONARIES.forEach((dict) => {
      expect(unique(dict.stats.items.map((stat) => stat.value))).toBe(true);
      expect(unique(dict.problem.cards.map((card) => card.title))).toBe(true);
      expect(unique(dict.how.steps.map((step) => step.title))).toBe(true);
      expect(unique(dict.data.rows.map((row) => row.what))).toBe(true);
      expect(unique(dict.demo.steps)).toBe(true);
      expect(unique(dict.sources.items)).toBe(true);
      expect(unique(dict.nav.links.map((link) => link.section))).toBe(true);
      expect(unique([...dict.hero.titleLines, dict.hero.titleHighlight])).toBe(true);
      expect(unique(dict.analyses.items.map((item) => item.letter))).toBe(true);
      expect(unique(dict.rotations.cards.map((card) => card.code))).toBe(true);
      expect(unique(dict.data.sees.items)).toBe(true);
      expect(unique(dict.data.blind.items)).toBe(true);
      [dict.problem, dict.how, dict.analyses, dict.rotations, dict.data, dict.demo].forEach(
        (section) => expect(unique(section.title)).toBe(true),
      );
      dict.analyses.items.forEach((item) => {
        expect(unique(item.bars.map((bar) => bar.label))).toBe(true);
      });
      dict.rotations.cards.forEach((card) => {
        expect(unique(card.sequence.map((crop) => crop.label))).toBe(true);
      });
    });
  });
});
