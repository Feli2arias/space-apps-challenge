/**
 * Turns the numbers, units and dates of an analysis into text for one language.
 *
 * Rules that hold everywhere in this file:
 * - A missing value (`null`, `undefined`, NaN, infinite) is never formatted as a
 *   number. Functions return `null` for it and the caller writes "sin dato".
 *   Zero is a real zero and is formatted like any other number.
 * - Dates are read and written in UTC, so the server and the browser print the
 *   same text whatever their time zone.
 * - Month names come from the tables below, not from the runtime, so they do
 *   not change between Node and browser versions.
 */

import type { Locale } from "@/lib/site";
import type { DateRange, Metric, Unit } from "./types";

/**
 * BCP 47 tags used for number formatting. Spanish follows the Costa Rican
 * convention (decimal comma, thin space for thousands), which matches the
 * figures already written on the landing page.
 */
const NUMBER_LOCALE: Readonly<Record<Locale, string>> = {
  es: "es-CR",
  en: "en-US",
};

/** Keeps a value and its unit on the same line. */
const NO_BREAK_SPACE = " ";

/** Decimals for coordinates: 0.00001° is about 1 m, enough to find the same point again. */
export const COORDINATE_DECIMALS = 5;

const MONTHS_SHORT: Readonly<Record<Locale, readonly string[]>> = {
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

const MONTHS_LONG: Readonly<Record<Locale, readonly string[]>> = {
  es: [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
};

const UNIT_LABELS: Readonly<Record<Locale, Readonly<Record<Unit, string>>>> = {
  es: {
    mm: "mm",
    "mm/year": "mm/año",
    "mm/month": "mm/mes",
    m: "m",
    percent: "%",
    degrees: "°",
    celsius: "°C",
    index: "",
    count: "",
    month: "",
    year: "",
    ha: "ha",
    "g/kg": "g/kg",
    pH: "pH",
  },
  en: {
    mm: "mm",
    "mm/year": "mm/year",
    "mm/month": "mm/month",
    m: "m",
    percent: "%",
    degrees: "°",
    celsius: "°C",
    index: "",
    count: "",
    month: "",
    year: "",
    ha: "ha",
    "g/kg": "g/kg",
    pH: "pH",
  },
};

export type MonthStyle = "short" | "long";

/** A value ready to print: the number as text, and its unit ("" when it has none). */
export interface FormattedValue {
  readonly text: string;
  readonly unit: string;
}

function isUsableNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Writes a number with a fixed count of decimals. `null` when the value is missing. */
export function formatNumber(
  value: number | null | undefined,
  locale: Locale,
  fractionDigits = 0,
): string | null {
  if (!isUsableNumber(value)) return null;
  return new Intl.NumberFormat(NUMBER_LOCALE[locale], {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    // Stops a small negative from being printed as "-0".
    signDisplay: "negative",
  }).format(value);
}

/**
 * How many decimals a unit deserves. The aim is to show what the products can
 * support and no more: a rainfall total to the millimetre, an index to two
 * decimals, small values with one extra digit so they do not collapse to zero.
 */
export function fractionDigitsFor(unit: Unit, value: number): number {
  const size = Math.abs(value);
  switch (unit) {
    case "mm":
    case "mm/year":
    case "mm/month":
    case "m":
    case "percent":
      return size < 10 ? 1 : 0;
    case "ha":
      if (size < 10) return 2;
      return size < 100 ? 1 : 0;
    case "degrees":
    case "celsius":
    case "g/kg":
    case "pH":
      return 1;
    case "index":
      return 2;
    case "count":
    case "month":
    case "year":
      return 0;
  }
}

/** The unit as written for the reader. Empty for units that are not written (index, count). */
export function unitLabel(unit: Unit, locale: Locale): string {
  return UNIT_LABELS[locale][unit] ?? "";
}

/** Name of a month given as 1 to 12. `null` for anything else. */
export function monthName(
  month: number | null | undefined,
  locale: Locale,
  style: MonthStyle = "long",
): string | null {
  if (!isUsableNumber(month) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  const table = style === "short" ? MONTHS_SHORT : MONTHS_LONG;
  return table[locale][month - 1];
}

/**
 * Formats a value in its unit. A value in "month" becomes the month's name and
 * a value in "year" is written without a thousands separator.
 */
export function formatValue(
  value: number | null | undefined,
  unit: Unit,
  locale: Locale,
): FormattedValue | null {
  if (!isUsableNumber(value)) return null;
  if (unit === "month") {
    const name = monthName(Math.round(value), locale, "long");
    return name === null ? null : { text: name, unit: "" };
  }
  if (unit === "year") return { text: String(Math.round(value)), unit: "" };
  const text = formatNumber(value, locale, fractionDigitsFor(unit, value));
  return text === null ? null : { text, unit: unitLabel(unit, locale) };
}

/** Joins a value and its unit the way each language writes them ("12 %" / "12%", "pH 5,5"). */
export function joinValueAndUnit(formatted: FormattedValue, locale: Locale): string {
  if (formatted.unit === "") return formatted.text;
  if (formatted.unit === "°") return `${formatted.text}°`;
  // pH is a scale, not a unit of measure: it is written before the number.
  if (formatted.unit === "pH") return `pH${NO_BREAK_SPACE}${formatted.text}`;
  if (formatted.unit === "%" && locale === "en") return `${formatted.text}%`;
  return `${formatted.text}${NO_BREAK_SPACE}${formatted.unit}`;
}

/** A value with its unit in one string, or `null` when the value is missing. */
export function formatValueWithUnit(
  value: number | null | undefined,
  unit: Unit,
  locale: Locale,
): string | null {
  const formatted = formatValue(value, unit, locale);
  return formatted === null ? null : joinValueAndUnit(formatted, locale);
}

export function formatMetricValue(metric: Metric, locale: Locale): FormattedValue | null {
  return formatValue(metric.value, metric.unit, locale);
}

interface CalendarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIsoDate(isoDate: string | null | undefined): CalendarDate | null {
  if (typeof isoDate !== "string") return null;
  const match = ISO_DATE_PATTERN.exec(isoDate);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // Round-trips through Date so that "2021-02-31" is rejected instead of rolled over.
  const probe = new Date(Date.UTC(year, month - 1, day));
  const isReal =
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day;
  return isReal ? { year, month, day } : null;
}

function writeCalendarDate(date: CalendarDate, locale: Locale): string {
  const month = MONTHS_SHORT[locale][date.month - 1];
  return locale === "es"
    ? `${date.day} ${month} ${date.year}`
    : `${month} ${date.day}, ${date.year}`;
}

/** Formats a calendar date written YYYY-MM-DD. `null` when it is not a real date. */
export function formatDate(isoDate: string | null | undefined, locale: Locale): string | null {
  const date = parseIsoDate(isoDate);
  return date === null ? null : writeCalendarDate(date, locale);
}

/** Formats an inclusive range of calendar dates. `null` when either end is not a real date. */
export function formatDateRange(
  range: DateRange | null | undefined,
  locale: Locale,
): string | null {
  if (!range) return null;
  const start = formatDate(range.start, locale);
  const end = formatDate(range.end, locale);
  if (start === null || end === null) return null;
  return `${start} – ${end}`;
}

/**
 * Formats an ISO 8601 instant as a date and time in UTC, and says so, because
 * the reader may be in another time zone than the server.
 */
export function formatInstantUtc(iso: string | null | undefined, locale: Locale): string | null {
  if (typeof iso !== "string" || iso.trim() === "") return null;
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;
  const date = writeCalendarDate(
    {
      year: instant.getUTCFullYear(),
      month: instant.getUTCMonth() + 1,
      day: instant.getUTCDate(),
    },
    locale,
  );
  const hours = String(instant.getUTCHours()).padStart(2, "0");
  const minutes = String(instant.getUTCMinutes()).padStart(2, "0");
  return `${date}, ${hours}:${minutes} UTC`;
}

/** Writes the moment a metric belongs to: a date, a month of a year, a month or a year. */
export function formatMetricMoment(at: Metric["at"], locale: Locale): string | null {
  if (!at) return null;
  if (at.date !== undefined) {
    const date = formatDate(at.date, locale);
    if (date !== null) return date;
  }
  const month = monthName(at.month, locale, "long");
  const year = isUsableNumber(at.year) ? String(Math.round(at.year)) : null;
  if (month !== null && year !== null) {
    return locale === "es" ? `${month} de ${year}` : `${month} ${year}`;
  }
  return month ?? year;
}

/**
 * Writes a latitude or longitude with a decimal point in both languages:
 * coordinates are values people copy into forms and maps, which expect a point.
 */
export function formatCoordinate(value: number | null | undefined): string | null {
  return isUsableNumber(value) ? value.toFixed(COORDINATE_DECIMALS) : null;
}

/** Metres in a kilometre; distances from this size up are written in km. */
const METERS_PER_KILOMETER = 1000;

/** Writes a distance in metres, switching to kilometres for large pixels ("11 km"). */
export function formatDistance(meters: number | null | undefined, locale: Locale): string | null {
  if (!isUsableNumber(meters)) return null;
  if (Math.abs(meters) < METERS_PER_KILOMETER) {
    const text = formatNumber(meters, locale, Number.isInteger(meters) ? 0 : 1);
    return `${text}${NO_BREAK_SPACE}m`;
  }
  const kilometers = meters / METERS_PER_KILOMETER;
  const text = formatNumber(kilometers, locale, Math.abs(kilometers) < 10 ? 1 : 0);
  return `${text}${NO_BREAK_SPACE}km`;
}

/** Writes a share given from 0 to 1 as a percentage ("42 %"). */
export function formatShare(share: number | null | undefined, locale: Locale): string | null {
  if (!isUsableNumber(share)) return null;
  return formatValueWithUnit(share * 100, "percent", locale);
}

const MILLISECONDS_PER_SECOND = 1000;

/** Writes a duration given in milliseconds as seconds with one decimal ("2,3 s"). */
export function formatDuration(
  milliseconds: number | null | undefined,
  locale: Locale,
): string | null {
  if (!isUsableNumber(milliseconds) || milliseconds < 0) return null;
  const text = formatNumber(milliseconds / MILLISECONDS_PER_SECOND, locale, 1);
  return `${text}${NO_BREAK_SPACE}s`;
}
