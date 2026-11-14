// Contract: ComparisonSummary
// Props: plans (readonly EditablePlan[], required) — current practice first
//        readings (ReadonlyMap<string, RotationReading>, required) — only readings that match
//          the plan's current crop
//        gap (boolean, required) · pending (boolean, required) · dict (RotationsDictionary)
// Variants: none
// States: per cell: figures | "not studied" | "unavailable" (rain gap) | "calculating"
// Accessibility: a real <table> with a caption, column headers per rotation and row headers per
//                reading; the two readings stay on separate rows and are never combined
// Responsive: three narrow columns plus a row-header column; text wraps inside cells from 320px

import type { RotationsDictionary } from "@/lib/i18n/app/rotations";
import type { RotationReading } from "@/lib/rotation/compare";
import { cn } from "@/lib/cn";
import { BASELINE_ID, type EditablePlan } from "./plans";
import { formatIncidence, formatRatio } from "./text";

interface ComparisonSummaryProps {
  readonly plans: readonly EditablePlan[];
  readonly readings: ReadonlyMap<string, RotationReading>;
  readonly gap: boolean;
  readonly pending: boolean;
  readonly dict: RotationsDictionary;
}

const CELL = "border border-ink p-2 align-top text-small";

function evidenceCell(reading: RotationReading | undefined, dict: RotationsDictionary): string {
  if (!reading) return dict.summary.pending;
  if (reading.evidence.length === 0) return dict.summary.notStudied;
  return reading.evidence
    .map((observation) => formatIncidence(observation.incidencePercent, dict))
    .join(" · ");
}

function exposureCell(
  plan: EditablePlan,
  reading: RotationReading | undefined,
  gap: boolean,
  dict: RotationsDictionary,
): string {
  if (gap) return dict.summary.unavailable;
  if (plan.id === BASELINE_ID) return dict.summary.baseline;
  const ratio = reading?.exposure?.relativeToBaseline;
  return formatRatio(ratio, dict) ?? dict.summary.pending;
}

export function ComparisonSummary({ plans, readings, gap, pending, dict }: ComparisonSummaryProps) {
  return (
    <div className="mr-1 overflow-x-auto">
      <table className="w-full table-fixed border-collapse bg-white">
        <caption className="pb-2 text-left">
          <span className="block font-mono text-small font-semibold tracking-brand uppercase">
            {dict.summary.title}
          </span>
          <span className="mt-1 block text-small text-muted">{dict.summary.caption}</span>
        </caption>
        <thead>
          <tr>
            <td className="w-[34%] border border-ink" />
            {plans.map((plan) => (
              <th key={plan.id} scope="col" className={cn(CELL, "text-left font-semibold break-words hyphens-auto")}>
                {dict.plans[plan.id]}
                <span className="block font-normal text-muted">
                  {dict.crops[plan.previousCrop]}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={cn("transition-opacity motion-reduce:transition-none", pending && "opacity-60")}>
          <tr>
            <th scope="row" className={cn(CELL, "text-left font-normal")}>
              {dict.summary.evidenceRow}
            </th>
            {plans.map((plan) => (
              <td key={plan.id} className={cn(CELL, "font-display tabular-nums")}>
                {evidenceCell(readings.get(plan.id), dict)}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row" className={cn(CELL, "text-left font-normal")}>
              {dict.summary.exposureRow}
            </th>
            {plans.map((plan) => (
              <td key={plan.id} className={cn(CELL, "font-display tabular-nums")}>
                {exposureCell(plan, readings.get(plan.id), gap, dict)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
