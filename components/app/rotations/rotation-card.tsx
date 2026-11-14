// Contract: RotationCard
// Props: plan (EditablePlan, required) — what the person declared for this rotation
//        reading (RotationReading | null, required) — the API's reading for this plan; null
//          until an answer for the plan's current crop arrives
//        study (RotationComparisonResult["study"] | null, required)
//        gap (boolean, required) — rainfall incomplete, no exposure reading
//        pending (boolean, required) — the shown answer is for an older version of the plans
//        onChange ((plan: EditablePlan) => void, required)
//        dict (RotationsDictionary, required)
// Variants: baseline (current practice: "Reference" badge, ratio is 1.00 by definition) | other
// States: example (badge "editable example") | edited (badge "edited by you") | pending
// Accessibility: an article labelled by its h3; the crop is a native <select> with a visible
//                label and help; the month grid has its own keyboard model (see MonthGridEditor);
//                the two readings and the notes each have a heading
// Responsive: one column inside the card at every width (the explorer puts up to three
//             cards side by side); select and cells are at least 44px tall

import { useId } from "react";
import { OriginTag } from "@/components/ui/origin-tag";
import type { RotationsDictionary } from "@/lib/i18n/app/rotations";
import type { RotationComparisonResult, RotationReading } from "@/lib/rotation/compare";
import { PREVIOUS_CROPS, type PreviousCrop } from "@/lib/rotation/evidence";
import { cn } from "@/lib/cn";
import { MonthGridEditor } from "./month-grid-editor";
import { planNotes, type Note } from "./notes";
import { BASELINE_ID, isExample, withMonth, withPreviousCrop, type EditablePlan } from "./plans";
import { EvidenceReading, ExposureReading } from "./readings";
import { noteText } from "./text";

interface RotationCardProps {
  readonly plan: EditablePlan;
  readonly reading: RotationReading | null;
  readonly study: RotationComparisonResult["study"] | null;
  readonly gap: boolean;
  readonly pending: boolean;
  readonly onChange: (plan: EditablePlan) => void;
  readonly dict: RotationsDictionary;
}

const LABEL = "font-mono text-label tracking-label text-cinnabar-deep uppercase";

function NoteList({ title, notes, dict }: { readonly title: string; readonly notes: readonly Note[]; readonly dict: RotationsDictionary }) {
  if (notes.length === 0) return null;
  return (
    <div>
      <h4 className={LABEL}>{title}</h4>
      <ul className="mt-2 flex list-[square] flex-col gap-1 pl-5 text-small">
        {notes.map((note) => (
          <li key={note.code}>{noteText(note, dict)}</li>
        ))}
      </ul>
    </div>
  );
}

export function RotationCard({ plan, reading, study, gap, pending, onChange, dict }: RotationCardProps) {
  const titleId = useId();
  const cropId = useId();
  const cropHelpId = useId();
  const isBaseline = plan.id === BASELINE_ID;
  const example = isExample(plan);
  const name = dict.plans[plan.id];
  const notes = reading ? planNotes(reading, gap, example) : null;

  return (
    <article aria-labelledby={titleId} className="min-w-0 border border-ink bg-white">
      <header className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-ink px-4 py-2.5">
        <h3 id={titleId} className="font-mono text-small font-semibold tracking-brand uppercase">
          {name}
        </h3>
        <span className="flex flex-wrap gap-1.5">
          {isBaseline ? (
            <span className="bg-ink px-2 py-1 font-mono text-label tracking-label text-white uppercase">
              {dict.baselineBadge}
            </span>
          ) : null}
          <span
            className={cn(
              "border px-2 py-1 font-mono text-label tracking-label uppercase",
              example ? "border-dashed border-ink" : "border-ink bg-cinnabar",
            )}
          >
            {example ? dict.exampleBadge : dict.editedBadge}
          </span>
        </span>
      </header>

      <div className="flex flex-col gap-5 p-4">
        <div className="flex flex-col gap-4">
          <OriginTag origin="declared" label={dict.origins.declared} className="text-muted" />
          <div className="flex flex-col gap-1.5">
            <label htmlFor={cropId} className={LABEL}>
              {dict.cropLabel}
            </label>
            <select
              id={cropId}
              aria-describedby={cropHelpId}
              value={plan.previousCrop}
              onChange={(event) => onChange(withPreviousCrop(plan, event.target.value as PreviousCrop))}
              className="min-h-11 w-full cursor-pointer border border-ink bg-white px-3 text-body"
            >
              {PREVIOUS_CROPS.map((crop) => (
                <option key={crop} value={crop}>
                  {dict.crops[crop]}
                </option>
              ))}
            </select>
            <p id={cropHelpId} className="text-small text-muted">
              {dict.cropHelp}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className={LABEL}>{dict.editor.label}</p>
            <MonthGridEditor
              months={plan.months}
              label={`${dict.editor.label} · ${name}`}
              onChange={(monthIndex, level) => onChange(withMonth(plan, monthIndex, level))}
              dict={dict}
            />
          </div>
        </div>

        <div className="border-t border-dashed border-line pt-5">
          <EvidenceReading reading={reading} study={study} dict={dict} />
        </div>
        <div className="border-t border-dashed border-line pt-5">
          <ExposureReading
            exposure={reading?.exposure ?? null}
            isBaseline={isBaseline}
            gap={gap}
            pending={pending}
            dict={dict}
          />
        </div>

        {notes ? (
          <div className="flex flex-col gap-4 border-t border-ink pt-5">
            <NoteList title={dict.notes.unknownTitle} notes={notes.unknown} dict={dict} />
            <NoteList title={dict.notes.reviewTitle} notes={notes.review} dict={dict} />
          </div>
        ) : null}
      </div>
    </article>
  );
}
