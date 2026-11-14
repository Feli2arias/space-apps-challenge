import { describe, expect, it } from "vitest";
import { extractNumbers, findUngroundedNumbers, parseWrittenNumber } from "./grounding";

const ALLOWED = [2392.2, 5.9, 13.1, 0.7649, 40.1, 2023, 2025, -84.72, 10.95, 4, 11000, 11, 30];

describe("parseWrittenNumber", () => {
  it("reads Spanish separators", () => {
    expect(parseWrittenNumber("2.392,2", "es")).toMatchObject({ value: 2392.2, decimals: 1 });
    expect(parseWrittenNumber("0,76", "es")).toMatchObject({ value: 0.76, decimals: 2 });
  });

  it("reads English separators", () => {
    expect(parseWrittenNumber("2,392.2", "en")).toMatchObject({ value: 2392.2, decimals: 1 });
    expect(parseWrittenNumber("0.76", "en")).toMatchObject({ value: 0.76, decimals: 2 });
  });

  it("rejects something that is not one number", () => {
    expect(parseWrittenNumber("1,2,3", "es")).toBeNull();
  });
});

describe("extractNumbers", () => {
  it("finds every number in a sentence", () => {
    const found = extractNumbers("Llueven 2.392 mm al año y la pendiente es de 5,9 %.", "es");
    expect(found.map((item) => item.value)).toEqual([2392, 5.9]);
  });

  it("reads thousands grouped with a space as one number", () => {
    const found = extractNumbers("Llueven 2 392 mm, o 2\u00a0392 mm, o 2\u202f392 mm.", "es");
    expect(found.map((item) => item.value)).toEqual([2392, 2392, 2392]);
  });

  it("keeps two separate numbers apart when the second is not a group of three digits", () => {
    const found = extractNumbers("En 2025 40 % era arcilla.", "es");
    expect(found.map((item) => item.value)).toEqual([2025, 40]);
  });

  it("returns nothing for text without numbers", () => {
    expect(extractNumbers("Sin datos de lluvia.", "es")).toEqual([]);
  });
});

describe("findUngroundedNumbers", () => {
  it("accepts numbers copied from the analysis, at the precision they were written", () => {
    const text = "Llueven 2.392 mm al año. Pendiente media de 5,9 % y máxima de 13,1 %. NDVI de 0,76.";
    expect(findUngroundedNumbers(text, ALLOWED, "es")).toEqual([]);
  });

  it("accepts the same numbers written in English", () => {
    const text = "It rains 2,392 mm a year. Mean slope is 5.9% and NDVI is 0.76.";
    expect(findUngroundedNumbers(text, ALLOWED, "en")).toEqual([]);
  });

  it("flags a number that is not in the analysis", () => {
    expect(findUngroundedNumbers("Se pierden 50 toneladas por hectárea.", ALLOWED, "es")).toEqual(["50"]);
    expect(findUngroundedNumbers("La pendiente es de 7,2 %.", ALLOWED, "es")).toEqual(["7,2"]);
  });

  it("flags a value that was rounded differently from the data", () => {
    expect(findUngroundedNumbers("NDVI de 0,80.", ALLOWED, "es")).toEqual(["0,80"]);
  });

  it("lets small whole numbers through, since they are ordinary words", () => {
    expect(findUngroundedNumbers("Hay 2 fuentes y 12 meses.", ALLOWED, "es")).toEqual([]);
  });

  it("checks a small whole number when a unit follows it", () => {
    expect(findUngroundedNumbers("Llovió un 12 % menos.", ALLOWED, "es")).toEqual(["12"]);
    expect(findUngroundedNumbers("Cayeron 8 mm.", ALLOWED, "es")).toEqual(["8"]);
    expect(findUngroundedNumbers("It rained 12% less.", ALLOWED, "en")).toEqual(["12"]);
    // 4 is in the analysis (hectares), so it is fine with its unit.
    expect(findUngroundedNumbers("El área es de 4 ha.", ALLOWED, "es")).toEqual([]);
  });

  it("ignores the sign, as prose writes coordinates without it", () => {
    expect(findUngroundedNumbers("En 10,95° N, 84,72° O.", ALLOWED, "es")).toEqual([]);
  });

  it("accepts years and pixel sizes that belong to the analysis", () => {
    expect(findUngroundedNumbers("Entre 2023 y 2025, con píxeles de 30 m y de 11 km.", ALLOWED, "es")).toEqual([]);
    expect(findUngroundedNumbers("Desde 2019.", ALLOWED, "es")).toEqual(["2019"]);
  });

  it("flags everything when nothing is allowed", () => {
    expect(findUngroundedNumbers("Llueven 2.392 mm.", [], "es")).toEqual(["2.392"]);
  });
});
