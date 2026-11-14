import { SOURCE_IDS, type SourceId } from "@/lib/analysis/types";
import type { Locale } from "@/lib/site";
import type { AnalysisFacts } from "./facts";
import { findUngroundedNumbers } from "./grounding";

/**
 * Checks shared by everything a language model writes about an analysis: the
 * answer is JSON, it only leans on sources that really answered, and it holds
 * no figure that is not in the analysis.
 */

export type Checked<T> =
  | { readonly ok: true; readonly value: T }
  /** `problem` is written for the model, so it can correct its answer. */
  | { readonly ok: false; readonly problem: string };

export function unique<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}

/** Sources with at least one result, the only ones a conclusion may rest on. */
export function sourcesWithFacts(facts: AnalysisFacts): readonly SourceId[] {
  return SOURCE_IDS.filter((source) => facts.facts.some((fact) => fact.source === source));
}

export function parseJson(raw: string): Checked<unknown> {
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, problem: "The answer was not a valid JSON object." };
  }
}

/** Says where a JSON answer departs from the shape that was asked for. */
export function shapeProblem(paths: readonly (readonly PropertyKey[])[]): string {
  const where = unique(paths.map((path) => path.map(String).join(".") || "(root)"));
  return `The JSON did not follow the requested shape or length limits at: ${where.join(", ")}.`;
}

/** `null` when every source named has results; otherwise the problem, for the model. */
export function sourceProblem(named: readonly SourceId[], facts: AnalysisFacts): string | null {
  const available = sourcesWithFacts(facts);
  const unavailable = unique(named.filter((source) => !available.includes(source)));
  return unavailable.length === 0
    ? null
    : `"basedOn" named sources that have no results in this analysis: ${unavailable.join(", ")}.`;
}

/** `null` when every figure written comes from the analysis; otherwise the problem, for the model. */
export function numberProblem(
  texts: readonly string[],
  facts: AnalysisFacts,
  locale: Locale,
): string | null {
  const ungrounded = unique(findUngroundedNumbers(texts.join("\n"), facts.allowedNumbers, locale));
  return ungrounded.length === 0
    ? null
    : `The text mentioned numbers that are not in the facts: ${ungrounded.join(", ")}. Use only numbers that appear in the JSON of facts, copied exactly, or no number at all.`;
}
