import type { Locale } from "@/lib/site";

/**
 * Checks that a generated summary only mentions numbers that exist in the
 * analysis. A summary with any other number is thrown away: the language
 * model is there to explain the results, never to add figures of its own.
 */

/** Integers this small are ordinary words in a sentence ("two sources", "the 3 months"). */
const SMALL_INTEGER_LIMIT = 12;

/**
 * A number in running text. Thousands may be grouped with a space (as Spanish
 * writes "2 392", with a plain, no-break or narrow no-break space) or with "."
 * or ","; the decimals follow "." or ",".
 */
const NUMBER_PATTERN = /\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)*/g;

const GROUPING_SPACES = /[ \u00a0\u202f]/g;

/**
 * What follows a measurement: a unit sign, or the word for one. A small whole
 * number followed by one of these is a figure ("12 %", "8 mm"), not a count
 * of things ("12 months"), and must come from the analysis like any other.
 */
const UNIT_AFTER = /^\s*(?:%|°|mm\b|cm\b|km\b|m\b|ha\b|g\/kg|percent\b|por ciento\b)/i;

const DECIMAL_SEPARATOR: Readonly<Record<Locale, string>> = { es: ",", en: "." };

interface WrittenNumber {
  /** True when a unit follows the number in the text. */
  readonly hasUnit: boolean;
  readonly raw: string;
  readonly value: number;
  /** Decimals written in the text, which sets how closely it must match. */
  readonly decimals: number;
}

/** Reads a number as written in the given language ("2.392,2" in Spanish, "2,392.2" in English). */
export function parseWrittenNumber(
  raw: string,
  locale: Locale,
  hasUnit = false,
): WrittenNumber | null {
  const decimalSeparator = DECIMAL_SEPARATOR[locale];
  const groupSeparator = decimalSeparator === "," ? "." : ",";
  const withoutGroups = raw.replace(GROUPING_SPACES, "").split(groupSeparator).join("");
  const parts = withoutGroups.split(decimalSeparator);
  if (parts.length > 2) return null;
  const value = Number(parts.join("."));
  if (!Number.isFinite(value)) return null;
  return { raw, value, decimals: parts[1]?.length ?? 0, hasUnit };
}

export function extractNumbers(text: string, locale: Locale): WrittenNumber[] {
  return Array.from(text.matchAll(NUMBER_PATTERN))
    .map((match) => {
      const after = text.slice(match.index + match[0].length);
      return parseWrittenNumber(match[0], locale, UNIT_AFTER.test(after));
    })
    .filter((parsed): parsed is WrittenNumber => parsed !== null);
}

/**
 * A written number is grounded when some allowed number, rounded to the same
 * number of decimals, gives exactly that value. Signs are ignored because
 * prose writes "84.72° W" for a longitude of -84.72.
 */
function isGrounded(written: WrittenNumber, allowed: readonly number[]): boolean {
  const scale = 10 ** written.decimals;
  return allowed.some(
    (candidate) => Math.round(Math.abs(candidate) * scale) === Math.round(written.value * scale),
  );
}

/** Returns the numbers in `text` that do not come from the analysis, as written. */
export function findUngroundedNumbers(
  text: string,
  allowed: readonly number[],
  locale: Locale,
): string[] {
  return extractNumbers(text, locale)
    .filter((written) => {
      const isSmallCount =
        !written.hasUnit &&
        written.decimals === 0 &&
        Number.isInteger(written.value) &&
        written.value <= SMALL_INTEGER_LIMIT;
      return !isSmallCount && !isGrounded(written, allowed);
    })
    .map((written) => written.raw);
}
