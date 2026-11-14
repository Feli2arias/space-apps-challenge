// Contract: EvidenceReading, ExposureReading
// Props: EvidenceReading — reading (RotationReading | null, required; null while the answer for
//          this crop is not back yet), study (RotationComparisonResult["study"], required), dict
//        ExposureReading — exposure (RotationExposure | null, required), isBaseline (boolean,
//          required), gap (boolean, required — rainfall incomplete), pending (boolean, required),
//          dict
// Variants: none
// States: Evidence: observations (incidence per study setting, significance group, host status) |
//           not studied (plain sentence: no evidence is not "no risk") | pending
//         Exposure: ratio with range and bare months | baseline (1.00 by definition) |
//           gap (reading unavailable and why) | pending (dimmed, "updating")
// Accessibility: each reading is a block with an h4; its origin tag is written as words; the
//                assumptions use a native <details> so they open with keyboard
// Responsive: one column; figures wrap under their label in narrow columns

import { OriginTag } from "@/components/ui/origin-tag";
import { fill } from "@/lib/i18n/app/results";
import type { RotationsDictionary } from "@/lib/i18n/app/rotations";
import type { RotationComparisonResult, RotationReading } from "@/lib/rotation/compare";
import type { RotationExposure } from "@/lib/rotation/exposure";
import { cn } from "@/lib/cn";
import { exposureDirection, formatIncidence, formatRatio, monthList } from "./text";

const LABEL = "font-mono text-label tracking-label text-cinnabar-deep uppercase";

interface EvidenceReadingProps {
  readonly reading: RotationReading | null;
  readonly study: RotationComparisonResult["study"] | null;
  readonly dict: RotationsDictionary;
}

function hostSentence(knownHost: boolean | null, dict: RotationsDictionary): string {
  if (knownHost === true) return dict.evidence.hostYes;
  return knownHost === false ? dict.evidence.hostNo : dict.evidence.hostUnknown;
}

function Observations({ reading, dict }: { readonly reading: RotationReading; readonly dict: RotationsDictionary }) {
  if (reading.evidence.length === 0) {
    return (
      <p className="border-l-2 border-cinnabar pl-3 text-body">
        {reading.previousCrop === "unknown" ? dict.evidence.notStudiedUnknownCrop : dict.evidence.notStudied}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {reading.evidence.map((observation) => (
        <li key={observation.setting} className="border border-ink p-3">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-title tabular-nums">
              {formatIncidence(observation.incidencePercent, dict)}
            </span>
            <span className="text-small">{dict.evidence.incidence}</span>
          </p>
          <p className="mt-1 text-small text-muted">{dict.evidence.settings[observation.setting]}</p>
          {observation.significanceGroup ? (
            <p className="mt-1 text-small text-muted">
              {fill(dict.evidence.group, { group: observation.significanceGroup })}. {dict.evidence.groupHelp}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function EvidenceReading({ reading, study, dict }: EvidenceReadingProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className={LABEL}>{dict.evidence.title}</h4>
        <OriginTag origin="study" label={dict.origins.study} className="text-muted" />
      </div>
      {reading ? (
        <>
          <Observations reading={reading} dict={dict} />
          {reading.previousCrop !== "unknown" ? (
            <p className="text-small">{hostSentence(reading.knownHost, dict)}</p>
          ) : null}
        </>
      ) : (
        <p className="text-small text-muted">{dict.summary.pending}</p>
      )}
      {study ? (
        <p className="text-small text-muted">
          {fill(dict.evidence.caveat, { region: study.region })}{" "}
          <a href={study.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
            {fill(dict.evidence.citation, { authors: study.authors, year: study.year, journal: study.journal })}
          </a>
        </p>
      ) : null}
    </div>
  );
}

interface ExposureReadingProps {
  readonly exposure: RotationExposure | null;
  readonly isBaseline: boolean;
  readonly gap: boolean;
  readonly pending: boolean;
  readonly dict: RotationsDictionary;
}

function ExposureFigures({ exposure, isBaseline, dict }: Omit<ExposureReadingProps, "gap" | "pending"> & { readonly exposure: RotationExposure }) {
  const ratio = exposure.relativeToBaseline;
  const range = exposure.relativeRange;
  const { exposure: words } = dict;
  return (
    <>
      {ratio !== null ? (
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-display text-numeral tabular-nums">{formatRatio(ratio, dict)}</span>
          <span className="text-small text-muted">{words.ratioUnit}</span>
        </p>
      ) : null}
      {isBaseline ? (
        <p className="text-small">{words.baselineRatio}</p>
      ) : ratio !== null ? (
        <p className="text-small">{words[exposureDirection(ratio)]}</p>
      ) : null}
      {!isBaseline && range ? (
        <p className="text-small text-muted">
          {fill(words.range, { low: formatRatio(range.low, dict) ?? "", high: formatRatio(range.high, dict) ?? "" })}
        </p>
      ) : null}
      <p className="text-small">
        {exposure.bareMonths.length > 0
          ? fill(words.bareMonths, { months: monthList(exposure.bareMonths, dict) })
          : words.bareMonthsNone}
        {exposure.bareMonths.length > 0
          ? ` ${
              exposure.bareRainyMonths.length > 0
                ? fill(words.bareRainyMonths, { months: monthList(exposure.bareRainyMonths, dict) })
                : words.bareRainyMonthsNone
            }`
          : ""}
      </p>
    </>
  );
}

export function ExposureReading({ exposure, isBaseline, gap, pending, dict }: ExposureReadingProps) {
  const { exposure: words } = dict;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className={LABEL}>{words.title}</h4>
        <OriginTag origin="modeled" label={dict.origins.modeled} className="text-muted" />
      </div>
      {gap && !pending ? (
        <p className="border-l-2 border-cinnabar pl-3 text-body">{words.gap}</p>
      ) : exposure ? (
        <div
          aria-busy={pending}
          className={cn("flex flex-col gap-2 transition-opacity motion-reduce:transition-none", pending && "opacity-50")}
        >
          <ExposureFigures exposure={exposure} isBaseline={isBaseline} dict={dict} />
        </div>
      ) : (
        <p className="text-small text-muted">{dict.summary.pending}</p>
      )}
      <p className="text-small text-muted">{words.rainSource}</p>
      <details className="group border border-line">
        <summary className="flex min-h-11 cursor-pointer items-center px-3 font-mono text-label tracking-label uppercase">
          {words.assumptionsTitle}
        </summary>
        <ul className="flex list-disc flex-col gap-1.5 px-3 pb-3 pl-7 text-small text-muted">
          {words.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
