// Contract: RainCoverStrip
// Props: analysis (Analysis, required) — rain climatology and vegetation scenes are read from it
//        dict (RotationsDictionary, required)
// Variants: none
// States: ok (12-month strip, coinciding and unknown months in words, thresholds) |
//         missing (a sentence naming the source that is missing; nothing is drawn) |
//         month without rainfall (checkered bar, "no rainfall data" in its sentence) |
//         month with too few clear scenes ("?" on a checkered cell)
// Accessibility: section labelled by its h3; the months are a list whose items carry a full
//                sentence for screen readers; the drawn strip is aria-hidden. Cover is drawn
//                with a letter AND a fill (outline = low, solid ink = vegetated, checker =
//                unknown); coinciding months add a "!" marker, never colour alone.
// Responsive: 12 equal columns that fit from 320px; labels stay mono and short

import { useId } from "react";
import { OriginTag } from "@/components/ui/origin-tag";
import { formatNumber, formatShare, formatValueWithUnit, monthName } from "@/lib/analysis/format";
import type { Analysis } from "@/lib/analysis/types";
import { fill } from "@/lib/i18n/app/results";
import type { RotationsDictionary } from "@/lib/i18n/app/rotations";
import { cn } from "@/lib/cn";
import { buildInsightView, type InsightMonthView, type MonthCover } from "./insight-view";
import { monthList } from "./text";

interface RainCoverStripProps {
  readonly analysis: Analysis;
  readonly dict: RotationsDictionary;
}

const COVER_CLASSES: Readonly<Record<MonthCover, string>> = {
  low: "border-dashed border-ink bg-white text-ink",
  green: "border-ink bg-ink text-white",
  unknown: "checker border-line bg-white text-stone",
};

function coverWords(cover: MonthCover, dict: RotationsDictionary) {
  const { insight } = dict;
  return cover === "low" ? insight.coverLow : cover === "green" ? insight.coverGreen : insight.coverUnknown;
}

function monthSentence(entry: InsightMonthView, dict: RotationsDictionary): string {
  const rain = formatValueWithUnit(entry.meanRainMm, "mm", dict.locale);
  const rainText = rain === null ? dict.insight.rainMissing : entry.rainierThanAverage ? `${rain}, ${dict.insight.rainier}` : rain;
  const sentence = fill(dict.insight.monthSentence, {
    month: monthName(entry.month, dict.locale, "long") ?? String(entry.month),
    rain: rainText,
    cover: coverWords(entry.cover, dict).name.toLowerCase(),
    clear: entry.usableObservations,
  });
  return entry.coinciding ? `${sentence} ${dict.insight.coincidingMark}.` : sentence;
}

function MonthColumn({ entry, dict }: { readonly entry: InsightMonthView; readonly dict: RotationsDictionary }) {
  const words = coverWords(entry.cover, dict);
  return (
    <li className="flex min-w-0 flex-col items-stretch gap-1">
      <span className="sr-only">{monthSentence(entry, dict)}</span>
      <span aria-hidden="true" className="h-4 text-center font-mono text-label text-cinnabar-deep">
        {entry.coinciding ? "!" : ""}
      </span>
      <span aria-hidden="true" className="relative block h-16 bg-mist">
        {entry.rainShareOfMax === null ? (
          <span className="checker absolute inset-0 border border-line bg-white text-stone" />
        ) : (
          <span
            className={cn("absolute inset-x-0 bottom-0 block", entry.rainierThanAverage ? "bg-cinnabar" : "bg-stone")}
            style={{ height: `${entry.rainShareOfMax * 100}%` }}
          />
        )}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "flex h-7 items-center justify-center border font-mono text-label font-semibold",
          COVER_CLASSES[entry.cover],
          entry.coinciding && "outline-2 outline-offset-1 outline-cinnabar",
        )}
      >
        <span className={cn(entry.cover === "unknown" && "bg-white px-0.5 text-ink")}>{words.letter}</span>
      </span>
      <span aria-hidden="true" className="truncate text-center font-mono text-label text-muted uppercase">
        {monthName(entry.month, dict.locale, "short")}
      </span>
    </li>
  );
}

function Legend({ dict }: { readonly dict: RotationsDictionary }) {
  const { insight } = dict;
  const items: readonly { readonly cover: MonthCover; readonly words: { letter: string; name: string } }[] = [
    { cover: "low", words: insight.coverLow },
    { cover: "green", words: insight.coverGreen },
    { cover: "unknown", words: insight.coverUnknown },
  ];
  return (
    <ul aria-hidden="true" className="flex flex-col gap-1.5 text-small text-muted">
      <li className="flex items-center gap-2">
        <span className="block size-4 bg-cinnabar" />
        {insight.rainRow} · {insight.rainier}
      </li>
      {items.map(({ cover, words }) => (
        <li key={cover} className="flex items-center gap-2">
          <span className={cn("flex size-4 items-center justify-center border font-mono text-label leading-none", COVER_CLASSES[cover])}>
            <span className={cn(cover === "unknown" && "bg-white text-ink")}>{words.letter}</span>
          </span>
          {words.name}
        </li>
      ))}
      <li className="flex items-center gap-2">
        <span className="block w-4 text-center font-mono text-cinnabar-deep">!</span>
        {insight.coincidingMark}
      </li>
    </ul>
  );
}

export function RainCoverStrip({ analysis, dict }: RainCoverStripProps) {
  const titleId = useId();
  const view = buildInsightView(analysis);
  const { insight } = dict;

  return (
    <section aria-labelledby={titleId} className="mr-1 border border-ink bg-white shadow-pixel-sm">
      <header className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-ink px-4 py-2.5">
        <h3 id={titleId} className="font-mono text-small font-semibold tracking-brand uppercase">
          {insight.title}
        </h3>
        <OriginTag origin="modeled" label={dict.origins.calculated} className="text-muted" />
      </header>

      <div className="flex flex-col gap-4 p-4">
        {view.kind === "missing" ? (
          <p className="border-l-2 border-cinnabar pl-4 text-body">
            {view.rain && view.vegetation
              ? insight.missingBoth
              : view.rain
                ? insight.missingRain
                : insight.missingVegetation}
          </p>
        ) : (
          <>
            <p className="text-body">{insight.intro}</p>
            <ol className="grid grid-cols-12 gap-0.5">
              {view.months.map((entry) => (
                <MonthColumn key={entry.month} entry={entry} dict={dict} />
              ))}
            </ol>
            <Legend dict={dict} />
            <div className="flex flex-col gap-1.5 border-l-2 border-cinnabar pl-4 text-body">
              <p>
                {view.insight.coincidingMonths.length > 0
                  ? fill(insight.coinciding, { months: monthList(view.insight.coincidingMonths, dict) })
                  : insight.coincidingNone}
                {view.insight.coincidingMonths.length > 0 && view.insight.rainShareInCoincidingMonths !== null
                  ? ` ${fill(insight.coincidingShare, { share: formatShare(view.insight.rainShareInCoincidingMonths, dict.locale) ?? "" })}`
                  : ""}
              </p>
              <p>
                {view.insight.unknownMonths.length > 0
                  ? fill(insight.unknown, { months: monthList(view.insight.unknownMonths, dict) })
                  : insight.unknownNone}
              </p>
            </div>
            <p className="text-small text-muted">{insight.scaleNote}</p>
            <p className="text-small text-muted">
              {fill(insight.thresholds, {
                threshold: formatNumber(view.insight.lowVegetationThreshold, dict.locale, 2) ?? "",
                min: view.insight.minObservationsPerMonth,
                majority: formatShare(view.insight.lowVegetationMajority, dict.locale) ?? "",
              })}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
