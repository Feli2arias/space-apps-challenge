import { describe, expect, it } from "vitest";
import { drawable, wrap } from "./pdf-text";

const LATIN = new Set(Array.from(" abcdefghijklmnñopqrstuvwxyzáéíóú0123456789.,%?->=<~ABCDEFGHIJKLMNOPQRSTUVWXYZ·–").map((c) => c.codePointAt(0) ?? 0));
const widthOf = (text: string) => text.length;

describe("drawable", () => {
  it("turns the spaces used to group thousands into plain spaces", () => {
    expect(drawable("2 392 mm", LATIN)).toBe("2 392 mm");
  });

  it("swaps signs the standard fonts lack for close equivalents", () => {
    expect(drawable("−5 a ≥ 10 → ok", LATIN)).toBe("-5 a >= 10 -> ok");
  });

  it("keeps accents and marks any other unknown character", () => {
    expect(drawable("Vegetación 🌱", LATIN)).toBe("Vegetación ?");
  });

  it("collapses line breaks and repeated spaces", () => {
    expect(drawable(" uno\n\n dos  tres ", LATIN)).toBe("uno dos tres");
  });
});

describe("wrap", () => {
  it("breaks at spaces without passing the width", () => {
    const lines = wrap("uno dos tres cuatro cinco", 9, widthOf);
    expect(lines).toEqual(["uno dos", "tres", "cuatro", "cinco"]);
    expect(lines.every((line) => line.length <= 9)).toBe(true);
  });

  it("cuts a word longer than the line", () => {
    const lines = wrap("abcdefghijkl mn", 5, widthOf);
    expect(lines).toEqual(["abcde", "fghij", "kl mn"]);
  });

  it("gives no lines for empty text", () => {
    expect(wrap("", 10, widthOf)).toEqual([]);
  });
});
