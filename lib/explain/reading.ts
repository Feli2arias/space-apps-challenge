import { z } from "zod";
import { SOURCE_IDS, type SourceId } from "@/lib/analysis/types";
import type { Locale } from "@/lib/site";
import type { AnalysisFacts } from "./facts";
import { numberProblem, parseJson, shapeProblem, sourceProblem, unique, type Checked } from "./grounded";

/**
 * The first reading of an analysis: a plain summary and three short lists
 * (what the data show in favour, what could be a problem, what is worth
 * checking). Each point names the sources it rests on and passes the same
 * checks as every other generated text.
 */

export const MAX_POINTS_PER_GROUP = 3;

export const READING_GROUPS = ["favorable", "alerts", "toCheck"] as const;
export type ReadingGroup = (typeof READING_GROUPS)[number];

export interface ReadingPoint {
  readonly title: string;
  /** One or two sentences, quoting the result it rests on. */
  readonly text: string;
  readonly basedOn: readonly SourceId[];
}

export interface Reading {
  /** What the results indicate and what they may imply for farming the plot. */
  readonly summary: string;
  readonly favorable: readonly ReadingPoint[];
  readonly alerts: readonly ReadingPoint[];
  readonly toCheck: readonly ReadingPoint[];
}

const text = (max: number) => z.string().trim().min(1).max(max);

const points = z
  .array(
    z.object({
      title: text(80),
      text: text(260),
      basedOn: z.array(z.enum(SOURCE_IDS)).min(1).max(SOURCE_IDS.length),
    }),
  )
  .max(MAX_POINTS_PER_GROUP);

const readingSchema = z.object({
  summary: text(600),
  favorable: points,
  alerts: points,
  toCheck: points,
});

/** Parses the model's answer and checks it against the analysis it was given. */
export function checkReading(raw: string, facts: AnalysisFacts, locale: Locale): Checked<Reading> {
  const json = parseJson(raw);
  if (!json.ok) return json;

  const parsed = readingSchema.safeParse(json.value);
  if (!parsed.success) {
    return { ok: false, problem: shapeProblem(parsed.error.issues.map((issue) => issue.path)) };
  }

  const clean = (items: readonly ReadingPoint[]) =>
    items.map((item) => ({ ...item, basedOn: unique(item.basedOn) }));
  const reading: Reading = {
    summary: parsed.data.summary,
    favorable: clean(parsed.data.favorable),
    alerts: clean(parsed.data.alerts),
    toCheck: clean(parsed.data.toCheck),
  };
  const all = READING_GROUPS.flatMap((group) => reading[group]);
  const problem =
    sourceProblem(all.flatMap((item) => item.basedOn), facts) ??
    numberProblem([reading.summary, ...all.flatMap((item) => [item.title, item.text])], facts, locale);

  return problem === null ? { ok: true, value: reading } : { ok: false, problem };
}
