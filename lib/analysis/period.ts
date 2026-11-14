import type { DateRange } from "./types";

/**
 * The analysis looks at whole calendar years so that annual totals are
 * comparable with each other. The current year is left out because it is
 * still incomplete.
 */
export function lastFullYears(years: number, now: Date): DateRange {
  const lastFullYear = now.getUTCFullYear() - 1;
  const firstYear = lastFullYear - years + 1;
  return { start: `${firstYear}-01-01`, end: `${lastFullYear}-12-31` };
}
