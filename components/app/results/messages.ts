/**
 * Safe lookups into the sources' message catalogues.
 *
 * The catalogues are written by other people and may lag behind the codes the
 * backend emits. Nothing here throws: a missing sentence falls back to the code
 * itself, so the reader sees an odd identifier instead of a broken panel, and
 * the gap is obvious to whoever maintains the catalogue.
 */

import type { LocalizedSourceMessages, SourceId, SourceMessages } from "@/lib/analysis/types";
import type { Locale } from "@/lib/site";

export type SourceCatalogue = Readonly<Partial<Record<SourceId, LocalizedSourceMessages>>>;

/** A piece of text and whether it came from the catalogue or is a fallback. */
export interface ResolvedText {
  readonly text: string;
  /** False when the catalogue had nothing and `text` is the raw code. */
  readonly known: boolean;
}

export interface ResolvedMetricText {
  readonly label: string;
  /** `null` when the catalogue gives no explanation. */
  readonly help: string | null;
  readonly known: boolean;
}

/** Returns the trimmed text, or `null` when it is not a string or is blank. */
export function presentText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** The catalogue of one source in one language, or `null` when it does not exist. */
export function messagesFor(
  catalogue: SourceCatalogue,
  source: SourceId,
  locale: Locale,
): SourceMessages | null {
  const localized = catalogue[source];
  if (!localized || typeof localized !== "object") return null;
  const messages = localized[locale];
  return messages && typeof messages === "object" ? messages : null;
}

/**
 * Reads one entry of a code table. `Object.hasOwn` keeps codes such as
 * "constructor" from matching something inherited from Object.
 */
function ownEntry(table: unknown, code: string): unknown {
  if (!table || typeof table !== "object") return undefined;
  return Object.hasOwn(table, code) ? (table as Record<string, unknown>)[code] : undefined;
}

/** The sentence for a code, or the code itself when the table has none. */
export function resolveCode(table: unknown, code: string): ResolvedText {
  const text = presentText(ownEntry(table, code));
  return text === null ? { text: code, known: false } : { text, known: true };
}

/** Label and explanation of a metric. Falls back to the metric id as the label. */
export function resolveMetric(messages: SourceMessages | null, metricId: string): ResolvedMetricText {
  const entry = ownEntry(messages?.metrics, metricId);
  const record = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
  const label = presentText(record?.label);
  return {
    label: label ?? metricId,
    help: presentText(record?.help),
    known: label !== null,
  };
}

/** Returns the catalogue's text when present, otherwise the fallback. */
export function textOr(value: unknown, fallback: string): string {
  return presentText(value) ?? fallback;
}
