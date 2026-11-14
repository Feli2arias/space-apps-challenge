import type { PreviousCrop } from "@/lib/rotation/evidence";
import type { RotationReading } from "@/lib/rotation/compare";

/**
 * "What is still unknown" and "review with the local agronomist" notes for one
 * rotation. Each note is drawn from the data of that rotation: the evidence
 * the API returned, its exposure reading and whether it is still the example.
 */

export type NoteCode =
  | "no-local-evidence"
  | "not-studied"
  | "host-unknown"
  | "crop-unknown"
  | "cover-declared"
  | "rain-incomplete"
  | "range-crosses"
  | "check-calendar"
  | "still-example"
  | "cover-rainy"
  | "host-risk"
  | "local-experience";

export interface Note {
  readonly code: NoteCode;
  /** The previous crop, for notes that name it. */
  readonly crop?: PreviousCrop;
  /** Calendar months (1 to 12), for notes that list them. */
  readonly months?: readonly number[];
}

export interface PlanNotes {
  readonly unknown: readonly Note[];
  readonly review: readonly Note[];
}

/** Crops whose name says nothing a study could look up. */
const UNNAMED_CROPS: readonly PreviousCrop[] = ["unknown", "other"];

function unknownNotes(reading: RotationReading, exposureMissing: boolean): Note[] {
  const crop = reading.previousCrop;
  const notes: Note[] = [];
  if (crop === "unknown") notes.push({ code: "crop-unknown" });
  else if (reading.evidence.length === 0) notes.push({ code: "not-studied", crop });
  else notes.push({ code: "no-local-evidence" });
  if (reading.knownHost === null && !UNNAMED_CROPS.includes(crop)) notes.push({ code: "host-unknown", crop });
  notes.push({ code: "cover-declared" });
  if (exposureMissing) notes.push({ code: "rain-incomplete" });
  const range = reading.exposure?.relativeRange;
  if (range && range.low < 1 && range.high > 1) notes.push({ code: "range-crosses" });
  return notes;
}

function reviewNotes(reading: RotationReading, stillExample: boolean): Note[] {
  const crop = reading.previousCrop;
  const notes: Note[] = [];
  if (stillExample) notes.push({ code: "still-example" });
  notes.push({ code: "check-calendar" });
  const bareRainy = reading.exposure?.bareRainyMonths ?? [];
  if (bareRainy.length > 0) notes.push({ code: "cover-rainy", months: bareRainy });
  if (reading.knownHost === true) notes.push({ code: "host-risk", crop });
  if (reading.evidence.length === 0 && !UNNAMED_CROPS.includes(crop)) {
    notes.push({ code: "local-experience", crop });
  }
  return notes;
}

export function planNotes(
  reading: RotationReading,
  exposureMissing: boolean,
  stillExample: boolean,
): PlanNotes {
  return { unknown: unknownNotes(reading, exposureMissing), review: reviewNotes(reading, stillExample) };
}
