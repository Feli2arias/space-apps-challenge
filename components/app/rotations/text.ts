import { formatNumber, monthName } from "@/lib/analysis/format";
import { fill } from "@/lib/i18n/app/results";
import { joinList, type RotationsDictionary } from "@/lib/i18n/app/rotations";
import type { Note } from "./notes";

/** Small text helpers shared by the rotation components. */

/** Ratios against the current practice are written with two decimals ("1,23"). */
export const RATIO_DECIMALS = 2;

export function formatRatio(value: number | null | undefined, dict: RotationsDictionary): string | null {
  return formatNumber(value, dict.locale, RATIO_DECIMALS);
}

/** "enero, mayo y junio" from calendar months 1 to 12. */
export function monthList(months: readonly number[], dict: RotationsDictionary): string {
  return joinList(
    months.map((month) => monthName(month, dict.locale, "long") ?? String(month)),
    dict,
  );
}

export function noteText(note: Note, dict: RotationsDictionary): string {
  return fill(dict.notes.codes[note.code], {
    crop: note.crop ? dict.crops[note.crop].toLowerCase() : "",
    months: note.months ? monthList(note.months, dict) : "",
  });
}

export type ExposureDirection = "lower" | "higher" | "same";

/** Compares the ratio as it is shown, so "1,00" is never called higher or lower. */
export function exposureDirection(ratio: number): ExposureDirection {
  const rounded = Number(ratio.toFixed(RATIO_DECIMALS));
  if (rounded < 1) return "lower";
  return rounded > 1 ? "higher" : "same";
}

/** Writes an incidence with the decimals the paper printed (63.57 stays 63,57; 25 stays 25). */
export function formatIncidence(percent: number, dict: RotationsDictionary): string {
  const decimals = String(percent).split(".")[1]?.length ?? 0;
  return `${formatNumber(percent, dict.locale, decimals) ?? ""}\u00a0%`;
}
