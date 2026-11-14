import { z } from "zod";
import { SOURCE_IDS, type SourceId } from "@/lib/analysis/types";
import type { Locale } from "@/lib/site";
import type { AnalysisFacts } from "./facts";
import { numberProblem, parseJson, shapeProblem, sourceProblem, unique, type Checked } from "./grounded";

/**
 * An answer to a question about one analysis. The model may only use the
 * results of that analysis: an answer with any other figure, or leaning on a
 * source without results, is discarded like every other generated text.
 */

export const MAX_QUESTION_LENGTH = 400;
/** Earlier questions and answers sent back as context. */
export const MAX_HISTORY_TURNS = 6;

export interface ChatTurn {
  readonly question: string;
  readonly answer: string;
}

export interface ChatAnswer {
  readonly answer: string;
  /** False when the analysis does not hold what the question asks for. */
  readonly answerable: boolean;
  readonly basedOn: readonly SourceId[];
}

const answerSchema = z.object({
  answer: z.string().trim().min(1).max(1200),
  answerable: z.boolean(),
  basedOn: z.array(z.enum(SOURCE_IDS)).max(SOURCE_IDS.length),
});

/** Parses the model's answer and checks it against the analysis it was given. */
export function checkAnswer(raw: string, facts: AnalysisFacts, locale: Locale): Checked<ChatAnswer> {
  const json = parseJson(raw);
  if (!json.ok) return json;

  const parsed = answerSchema.safeParse(json.value);
  if (!parsed.success) {
    return { ok: false, problem: shapeProblem(parsed.error.issues.map((issue) => issue.path)) };
  }

  const basedOn = unique(parsed.data.basedOn);
  const problem =
    sourceProblem(basedOn, facts) ?? numberProblem([parsed.data.answer], facts, locale);
  return problem === null
    ? { ok: true, value: { answer: parsed.data.answer, answerable: parsed.data.answerable, basedOn } }
    : { ok: false, problem };
}
