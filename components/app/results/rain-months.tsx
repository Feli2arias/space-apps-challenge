// Contract: RainMonths
// Props: climatology (readonly RainClimatologyMonth[] | null, required) — mean, min and max
//          rain of each calendar month over the period
//        dict (ResultsDictionary, required), layout (ResultsLayoutDictionary, required)
// Variants: none
// States: per month — value (mean written in the cell, driest–wettest year below it, tint by
//         the mean) | missing ("sin dato", no tint). Whole strip — default | no month has a
//         value (a sentence instead of the strip)
// Accessibility: an ordered list of twelve months; each item is read as one sentence
//                ("enero: 56 mm, entre 3 y 133 mm"); the tint is decorative and the value is
//                always written. Ink on cinnabar keeps at least 6.3:1 at any tint.
// Responsive: container queries — 4 columns on a phone, 6 from @md, 12 from @4xl

import { formatNumber, formatValueWithUnit, monthName } from "@/lib/analysis/format";
import type { RainClimatologyMonth } from "@/lib/analysis/types";
import { fill, type ResultsDictionary } from "@/lib/i18n/app/results";
import type { ResultsLayoutDictionary } from "@/lib/i18n/app/results-layout";
import { tintOpacity } from "./tint";
import { buildRainChart } from "./view-model";

interface RainMonthsProps {
  readonly climatology: readonly RainClimatologyMonth[] | null | undefined;
  readonly dict: ResultsDictionary;
  readonly layout: ResultsLayoutDictionary;
}

export function RainMonths({ climatology, dict, layout }: RainMonthsProps) {
  const { locale } = dict;
  const strip = buildRainChart(climatology);
  const whole = (value: number | null) => formatNumber(value, locale, 0);

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h4 className="font-mono text-label tracking-label text-cinnabar-deep uppercase">{layout.rainMonths.title}</h4>
        {strip.hasValues ? <p className="mt-1 max-w-[70ch] text-small text-muted">{layout.rainMonths.caption}</p> : null}
      </div>
      {strip.hasValues ? (
        <ol className="grid grid-cols-4 gap-px bg-line @md:grid-cols-6 @4xl:grid-cols-12">
          {strip.rows.map((row) => {
            const name = monthName(row.month, locale, "long") ?? String(row.month);
            const mean = formatValueWithUnit(row.meanMm, "mm", locale);
            const min = whole(row.minMm);
            const max = whole(row.maxMm);
            const range = min !== null && max !== null ? `${min}–${max}` : null;
            const spoken = `${name}: ${mean ?? dict.missing}${
              range ? `, ${fill(dict.rain.range, { min: `${min} mm`, max: `${max} mm` })}` : ""
            }`;
            return (
              <li key={row.month} className="relative min-w-0 bg-white px-2 py-2">
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-cinnabar"
                  style={{ opacity: tintOpacity(row.meanShare) }}
                />
                <span className="sr-only">{spoken}</span>
                <span aria-hidden="true" className="relative flex flex-col gap-0.5">
                  <span className="font-mono text-label tracking-label uppercase">
                    {monthName(row.month, locale, "short")}
                  </span>
                  <span className="font-mono text-small font-semibold tabular-nums">{mean ?? dict.missing}</span>
                  {range ? <span className="font-mono text-label tabular-nums">{range}</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-small text-muted">{dict.rain.empty}</p>
      )}
    </section>
  );
}
