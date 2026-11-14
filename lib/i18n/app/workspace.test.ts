import { describe, expect, it } from "vitest";
import { LOCALE_PATH } from "@/lib/site";
import { placeholdersOf } from "./results";
import { APP_PATH, WORKSPACE_DICTIONARY, getWorkspaceDictionary, type WorkspaceDictionary } from "./workspace";

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

const { es, en } = WORKSPACE_DICTIONARY;

/** These differ between languages by design, so they are left out of the comparisons. */
const LANGUAGE_FIELDS = new Set(["locale", "header.otherLocale"]);

function texts(dict: WorkspaceDictionary): Array<[string, string]> {
  return collectStrings(dict, "").filter(([path]) => !LANGUAGE_FIELDS.has(path));
}

describe("workspace dictionary", () => {
  it("has the same keys in both languages", () => {
    const paths = (dict: WorkspaceDictionary) => texts(dict).map(([path]) => path);
    expect(paths(en)).toEqual(paths(es));
  });

  it("has no empty text", () => {
    [es, en].forEach((dict) => {
      const empty = texts(dict).filter(([, text]) => text.trim() === "");
      expect(empty).toEqual([]);
    });
  });

  it("uses the same placeholders in both languages", () => {
    const placeholders = (dict: WorkspaceDictionary) =>
      texts(dict).map(([path, text]) => [path, [...placeholdersOf(text)].sort()]);
    expect(placeholders(en)).toEqual(placeholders(es));
  });

  it("says that a coordinate is a point and that the outline is not a verified boundary", () => {
    expect(es.form.area.pointNote).toContain("no una parcela");
    expect(en.form.area.pointNote).toContain("not a plot");
    expect(es.form.outline.disclaimer).toMatch(/no es un límite de propiedad verificado/i);
    expect(en.form.outline.disclaimer).toMatch(/not a verified property boundary/i);
  });

  it("never promises a percentage while loading", () => {
    [es, en].forEach((dict) => {
      const withPercent = collectStrings(dict.loader, "loader").filter(([, text]) => text.includes("%"));
      expect(withPercent).toEqual([]);
    });
  });

  it("offers the other language in that language", () => {
    expect(es.header.otherLocale).toBe("en");
    expect(en.header.otherLocale).toBe("es");
    expect(getWorkspaceDictionary("es")).toBe(es);
    expect(getWorkspaceDictionary("en")).toBe(en);
  });

  it("lives under each language's home page", () => {
    expect(APP_PATH.es).toBe("/app");
    expect(APP_PATH.en).toBe(`${LOCALE_PATH.en}/app`);
  });
});
