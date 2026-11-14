// Contract: SlopeClasses
// Props: data (TerrainData, required) — share of the area in each slope class, and sampling
//        dict (ResultsDictionary, required), layout (ResultsLayoutDictionary, required)
// Variants: none
// States: default | a class with a share of zero ("0,0 % del área") | a class with no share
//         ("sin dato") | no classes (a sentence instead of the rows)
// Accessibility: a definition list — class name and slope range as the term, share as the
//                value; nothing depends on length or colour
// Responsive: name and range on the left, share on the right, from 320px up

import { formatDistance, formatNumber, formatShare } from "@/lib/analysis/format";
import type { SlopeClassShare, TerrainData } from "@/lib/analysis/types";
import { fill, type ResultsDictionary } from "@/lib/i18n/app/results";
import type { ResultsLayoutDictionary } from "@/lib/i18n/app/results-layout";

interface SlopeClassesProps {
  readonly data: TerrainData;
  readonly dict: ResultsDictionary;
  readonly layout: ResultsLayoutDictionary;
}

function isShare(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && value <= 1;
}

/** Writes a class bound without decimals when it has none ("2", "7,5"). */
function formatBound(value: number, dict: ResultsDictionary): string {
  return formatNumber(value, dict.locale, Number.isInteger(value) ? 0 : 1) ?? dict.missing;
}

function rangeText(entry: SlopeClassShare, dict: ResultsDictionary): string {
  const from = formatBound(entry.fromPercent, dict);
  return entry.toPercent === null || entry.toPercent === undefined
    ? fill(dict.terrain.rangeFrom, { from })
    : fill(dict.terrain.rangeBetween, { from, to: formatBound(entry.toPercent, dict) });
}

function className(entry: SlopeClassShare, dict: ResultsDictionary): string {
  return Object.hasOwn(dict.terrain.classes, entry.slopeClass)
    ? dict.terrain.classes[entry.slopeClass]
    : String(entry.slopeClass);
}

export function SlopeClasses({ data, dict, layout }: SlopeClassesProps) {
  const { terrain, locale } = dict;
  const classes = data.slopeClasses ?? [];

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h4 className="font-mono text-label tracking-label text-cinnabar-deep uppercase">{terrain.slopeTitle}</h4>
        {classes.length > 0 ? <p className="mt-1 max-w-[70ch] text-small text-muted">{terrain.slopeCaption}</p> : null}
      </div>
      {classes.length === 0 ? (
        <p className="text-small text-muted">{terrain.empty}</p>
      ) : (
        <dl className="flex max-w-xl flex-col">
          {classes.map((entry) => (
            <div key={entry.slopeClass} className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-b-0">
              <dt className="text-small">
                {className(entry, dict)} <span className="text-muted">· {rangeText(entry, dict)}</span>
              </dt>
              <dd className="font-mono text-small font-semibold tabular-nums">
                {isShare(entry.share)
                  ? fill(layout.slopeShare, { share: formatShare(entry.share, locale) ?? dict.missing })
                  : dict.missing}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p className="max-w-[70ch] text-small text-muted">
        {fill(terrain.samples, {
          valid: formatNumber(data.validSamples, locale) ?? dict.missing,
          samples: formatNumber(data.samples, locale) ?? dict.missing,
          spacing: formatDistance(data.gridSpacingMeters, locale) ?? dict.missing,
        })}
      </p>
    </section>
  );
}
