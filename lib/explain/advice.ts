import { z } from "zod";
import { SOURCE_IDS, type SourceId } from "@/lib/analysis/types";
import type { Locale } from "@/lib/site";
import type { AnalysisFacts } from "./facts";
import { numberProblem, parseJson, shapeProblem, sourceProblem, unique, type Checked } from "./grounded";

/**
 * The recommendations a language model writes from an analysis, and the checks
 * they must pass before anyone sees them: the expected shape, sources that
 * really answered, and no figure that is not in the analysis.
 */

export const MAX_RECOMMENDATIONS = 5;

export interface Recommendation {
  /** A few words naming the recommendation. */
  readonly title: string;
  /** What to do, in one or two sentences. */
  readonly action: string;
  /** The reason, quoting the results it rests on. */
  readonly why: string;
  /** Which sources of the analysis support it. */
  readonly basedOn: readonly SourceId[];
}

export interface Advice {
  readonly recommendations: readonly Recommendation[];
}

const text = (max: number) => z.string().trim().min(1).max(max);

const adviceSchema = z.object({
  recommendations: z
    .array(
      z.object({
        title: text(90),
        action: text(360),
        why: text(520),
        basedOn: z.array(z.enum(SOURCE_IDS)).min(1).max(SOURCE_IDS.length),
      }),
    )
    .min(1)
    .max(MAX_RECOMMENDATIONS),
});

/** Parses the model's answer and checks it against the analysis it was given. */
export function checkAdvice(raw: string, facts: AnalysisFacts, locale: Locale): Checked<Advice> {
  const json = parseJson(raw);
  if (!json.ok) return json;

  const parsed = adviceSchema.safeParse(json.value);
  if (!parsed.success) {
    return { ok: false, problem: shapeProblem(parsed.error.issues.map((issue) => issue.path)) };
  }

  const recommendations = parsed.data.recommendations.map((item) => ({
    ...item,
    basedOn: unique(item.basedOn),
  }));
  const problem =
    sourceProblem(recommendations.flatMap((item) => item.basedOn), facts) ??
    numberProblem(recommendations.flatMap((item) => [item.title, item.action, item.why]), facts, locale);

  return problem === null ? { ok: true, value: { recommendations } } : { ok: false, problem };
}
