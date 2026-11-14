// Contract: VegetationMonths
// Props: data (VegetationData, required) — scenes examined, monthly NDVI, threshold
//        period (DateRange | null, required) — the months to lay out
//        dict (ResultsDictionary, required), layout (ResultsLayoutDictionary, required)
// Variants: none
// States: per month — usable (NDVI written in the cell, tint by NDVI) | images but none clear
//         ("nubes") | no image ("—") | outside the period (not drawn). Gaps are never filled.
//         Whole block — default | nothing to lay out (a sentence instead of the grid)
// Accessibility: one list per year; each month is read as a sentence ("marzo 2024: NDVI
//                0,71" / "…: sin imágenes"); the tint is decorative. The scene counts per
//                month stay in an expandable table; the threshold sentence makes no claim
//                about crops or plant health.
// Responsive: container queries — 4 columns on a phone, 6 from @md, 12 from @4xl

import { formatDate, formatNumber, formatShare, monthName } from "@/lib/analysis/format";
import type { DateRange, VegetationData } from "@/lib/analysis/types";
import { fill, type ResultsDictionary } from "@/lib/i18n/app/results";
import type { ResultsLayoutDictionary } from "@/lib/i18n/app/results-layout";
import { cn } from "@/lib/cn";
import { tintOpacity } from "./tint";
import { buildVegetationTimeline, countScenes, type TimelineCell } from "./view-model";

interface VegetationMonthsProps {
  readonly data: VegetationData;
  readonly period: DateRange | null;
  readonly dict: ResultsDictionary;
  readonly layout: ResultsLayoutDictionary;
}

/** Decimals for NDVI, an index that the products support to about two places. */
const NDVI_DECIMALS = 2;

function isShare(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && value <= 1;
}

function cellWords(cell: TimelineCell, dict: ResultsDictionary, layout: ResultsLayoutDictionary) {
  const value = formatNumber(cell.ndviMean, dict.locale, NDVI_DECIMALS);
  if (cell.state === "usable" && value !== null) return { short: value, long: `NDVI ${value}` };
  if (cell.state === "unusable") return { short: layout.vegetationMonths.cloudy, long: layout.vegetationMonths.cloudyLong };
  return { short: layout.vegetationMonths.none, long: layout.vegetationMonths.noneLong };
}

function MonthlyTable({ cells, dict }: { readonly cells: readonly TimelineCell[]; readonly dict: ResultsDictionary }) {
  const { vegetation } = dict;
  const headClass = "py-1.5 pr-3 text-left font-mono text-label tracking-label text-muted uppercase";
  return (
    <table className="mt-2 w-full border-collapse text-small tabular-nums">
      <thead>
        <tr className="border-b border-ink">
          <th scope="col" className={headClass}>{vegetation.columnMonth}</th>
          <th scope="col" className={headClass}>{vegetation.columnNdvi}</th>
          <th scope="col" className={headClass}>{vegetation.columnScenes}</th>
        </tr>
      </thead>
      <tbody>
        {cells.map((cell) => (
          <tr key={`${cell.year}-${cell.month}`} className="border-b border-line">
            <th scope="row" className="py-1.5 pr-3 text-left font-normal whitespace-nowrap">
              {monthName(cell.month, dict.locale, "short")} {cell.year}
            </th>
            <td className={cn("py-1.5 pr-3", cell.ndviMean === null && "text-muted")}>
              {formatNumber(cell.ndviMean, dict.locale, NDVI_DECIMALS) ?? dict.missing}
            </td>
            <td className="py-1.5">
              {cell.totalObservations > 0
                ? fill(vegetation.scenesOfTotal, { usable: cell.usableObservations, total: cell.totalObservations })
                : vegetation.noScenes}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function VegetationMonths({ data, period, dict, layout }: VegetationMonthsProps) {
  const { vegetation, locale } = dict;
  const timeline = buildVegetationTimeline(data.monthly, period);
  const scenes = countScenes(data.observations);
  const threshold = isShare(data.lowVegetationThreshold) ? data.lowVegetationThreshold : null;
  const cells = timeline.years.flatMap((year) => year.cells).filter((cell) => cell.state !== "outside");
  const first = data.observations?.at(0)?.date;
  const last = data.observations?.at(-1)?.date;
  const span = first && last ? `${formatDate(first, locale)} – ${formatDate(last, locale)}` : null;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h4 className="font-mono text-label tracking-label text-cinnabar-deep uppercase">{layout.vegetationMonths.title}</h4>
        <p className="mt-1 max-w-[70ch] text-small">
          {fill(vegetation.scenes, { usable: scenes.usable, total: scenes.total })}
          {span && scenes.total > 0 ? ` (${span})` : ""}.{" "}
          {fill(vegetation.months, { usable: timeline.usableMonths, total: timeline.monthsInPeriod })}.
        </p>
        {timeline.years.length > 0 ? (
          <p className="mt-1 max-w-[70ch] text-small text-muted">{layout.vegetationMonths.caption}</p>
        ) : null}
      </div>

      {timeline.years.length === 0 ? (
        <p className="text-small text-muted">{vegetation.empty}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {timeline.years.map((year) => (
            <div key={year.year} className="flex flex-col gap-1">
              <h5 className="font-mono text-label tracking-label text-muted">{year.year}</h5>
              <ol className="grid grid-cols-4 gap-px bg-line @md:grid-cols-6 @4xl:grid-cols-12">
                {year.cells.map((cell) => {
                  if (cell.state === "outside") return <li key={cell.month} aria-hidden="true" className="bg-paper" />;
                  const words = cellWords(cell, dict, layout);
                  return (
                    <li key={cell.month} data-state={cell.state} className="relative min-w-0 bg-white px-2 py-1.5">
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 bg-cinnabar"
                        style={{ opacity: cell.state === "usable" ? tintOpacity(cell.heightShare) : 0 }}
                      />
                      <span className="sr-only">
                        {`${monthName(cell.month, locale, "long")} ${year.year}: ${words.long}`}
                      </span>
                      <span aria-hidden="true" className="relative flex flex-col">
                        <span className="font-mono text-label tracking-label uppercase">
                          {monthName(cell.month, locale, "short")}
                        </span>
                        <span className={cn("font-mono text-small tabular-nums", cell.state === "usable" ? "font-semibold" : "text-muted")}>
                          {words.short}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}

      {threshold !== null ? (
        <p className="max-w-[70ch] border-l-2 border-cinnabar pl-3 text-small">
          {fill(vegetation.threshold, { value: formatNumber(threshold, locale, NDVI_DECIMALS) ?? dict.missing })}
        </p>
      ) : null}

      <p className="max-w-[70ch] text-small text-muted">
        {fill(vegetation.clearRule, { share: formatShare(data.minClearFraction, locale) ?? dict.missing })}{" "}
        {fill(vegetation.pixels, { count: formatNumber(data.pixelsInArea, locale) ?? dict.missing })}
      </p>

      {cells.length > 0 ? (
        <details>
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-mono text-label tracking-label uppercase underline underline-offset-4">
            {vegetation.tableToggle}
          </summary>
          <MonthlyTable cells={cells} dict={dict} />
        </details>
      ) : null}
    </section>
  );
}
