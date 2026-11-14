"use client";

// Contract: ResultsPanelView
// Props: analysis (Analysis, required) — the only source of every figure shown
//        locale (Locale, required)
//        onRetry ((source: SourceId) => void, required)
//        retrying (readonly SourceId[], required) — sources being queried again right now
//        catalogue (SourceCatalogue, required) — the sources' message catalogues. The public
//          ResultsPanel passes the real ones; the layout preview passes sample text.
//        reading (ReactNode, optional) — the AI reading of the plot, shown first
//        advice (ReactNode, optional) — the AI recommendations, after the data cards
//        rotations (ReactNode, optional) — the rotations tool, offered at the end as one closed
//          section
//        titleId, headingRef, plotActions (optional) — see ScannedPlot
// Variants: none
// States: one scrolling page under the "Terreno escaneado" box: reading → "Los datos del
//         terreno" with one card per source → advice → rotations (closed). Without an AI
//         key the two AI slots render nothing and the page starts at the data.
//         complete | partial (missing sources named in the box and explained on their card) |
//         failed (every card explains its error with Retry). A caveat is added to the
//         temperature card when the climate product's grid cell and the terrain differ in
//         altitude by more than the threshold.
// Accessibility: a region labelled by the "Terreno escaneado" heading (h2); then h2 (data)
//                → h3 (card) → h4 (detail); `lang` is set; cards open with real buttons; the
//                rotations section is a native <details> in a region labelled by its title;
//                missing values are "sin dato"
// Responsive: container queries on the scrolling area — cards in 1 column on a phone, 2 from
//             @2xl, 3 from @6xl; content is centred at most 72rem wide

import { useId, type ReactNode, type Ref } from "react";
import { PixelIcon } from "@/components/ui/pixel-icon";
import { PIXEL_ICONS } from "@/components/ui/pixel-icons";
import { formatValueWithUnit } from "@/lib/analysis/format";
import type { Analysis, SourceId } from "@/lib/analysis/types";
import { SOURCE_IDS } from "@/lib/analysis/types";
import { getReportDictionary } from "@/lib/i18n/app/report";
import { fill, getResultsDictionary, type ResultsDictionary } from "@/lib/i18n/app/results";
import { getResultsLayoutDictionary } from "@/lib/i18n/app/results-layout";
import type { Locale } from "@/lib/site";
import { RESULT_ICONS } from "./bitmap-icon";
import { ClimateTable } from "./climate-table";
import { messagesFor, textOr, type SourceCatalogue } from "./messages";
import { RainMonths } from "./rain-months";
import { buildReport } from "./report-sentences";
import { ScannedPlot } from "./scanned-plot";
import { SlopeClasses } from "./slope-classes";
import { SoilTable } from "./soil-table";
import { SourceCard } from "./source-card";
import { VegetationMonths } from "./vegetation-months";
import { checkElevationMismatch, type ElevationMismatch } from "./view-model";

export interface ResultsPanelViewProps {
  readonly analysis: Analysis;
  readonly locale: Locale;
  readonly onRetry: (source: SourceId) => void;
  readonly retrying: readonly SourceId[];
  readonly catalogue: SourceCatalogue;
  readonly reading?: ReactNode;
  readonly advice?: ReactNode;
  readonly rotations?: ReactNode;
  /** Id for the "Terreno escaneado" heading, when the caller labels something with it. */
  readonly titleId?: string;
  readonly headingRef?: Ref<HTMLHeadingElement>;
  /** "Ver mapa" and "Analizar otro terreno", shown in the "Terreno escaneado" box. */
  readonly plotActions?: ReactNode;
}

const SOURCE_ICONS: Readonly<Record<SourceId, readonly string[]>> = {
  rain: PIXEL_ICONS.rain,
  vegetation: PIXEL_ICONS.sprout,
  terrain: PIXEL_ICONS.slope,
  soil: RESULT_ICONS.soil,
  climate: RESULT_ICONS.climate,
};

/** Plain warning that the regional temperature belongs to another altitude. */
function ElevationNote({ mismatch, dict }: { readonly mismatch: ElevationMismatch; readonly dict: ResultsDictionary }) {
  const meters = (value: number) => formatValueWithUnit(value, "m", dict.locale) ?? dict.missing;
  return (
    <div className="border-l-2 border-cinnabar pl-3">
      <p className="text-small font-semibold">{dict.elevationCheck.title}</p>
      <p className="mt-1 text-small">
        {fill(dict.elevationCheck.body, {
          grid: meters(mismatch.gridCellMeters),
          terrain: meters(mismatch.terrainMeters),
          difference: meters(mismatch.differenceMeters),
        })}
      </p>
    </div>
  );
}

interface ToolSectionProps {
  readonly title: string;
  readonly note: string;
  readonly children: ReactNode;
}

/** A tool closed by default, framed above and below; its content stays mounted so edits survive. */
function ToolSection({ title, note, children }: ToolSectionProps) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId}>
      <details className="group border-y border-line">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 [&::-webkit-details-marker]:hidden">
          <span className="flex flex-col gap-0.5">
            <span id={titleId} className="font-display text-h3 uppercase">{title}</span>
            <span className="text-small text-muted">{note}</span>
          </span>
          <PixelIcon name="arrow" className="h-2.5 w-3 shrink-0 rotate-90 group-open:-rotate-90" />
        </summary>
        <div className="pt-2 pb-8">{children}</div>
      </details>
    </section>
  );
}

export function ResultsPanelView({
  analysis,
  locale,
  onRetry,
  retrying,
  catalogue,
  reading,
  advice,
  rotations,
  titleId: givenTitleId,
  headingRef,
  plotActions,
}: ResultsPanelViewProps) {
  const ownTitleId = useId();
  const dataId = useId();
  const titleId = givenTitleId ?? ownTitleId;
  const dict = getResultsDictionary(locale);
  const layout = getResultsLayoutDictionary(locale);
  const report = getReportDictionary(locale);
  const sources = analysis.sources;
  const areaKind = analysis.area?.kind ?? "buffer";
  const messages = (source: SourceId) => messagesFor(catalogue, source, dict.locale);
  const sourceTitles = Object.fromEntries(
    SOURCE_IDS.map((source) => [source, textOr(messages(source)?.title, dict.sourceNames[source])]),
  ) as Record<SourceId, string>;
  const mismatch = checkElevationMismatch(sources?.terrain, sources?.climate);

  const details: Readonly<Record<SourceId, ReactNode>> = {
    rain: sources?.rain?.data ? <RainMonths climatology={sources.rain.data.climatology} dict={dict} layout={layout} /> : null,
    vegetation: sources?.vegetation?.data ? (
      <VegetationMonths
        data={sources.vegetation.data}
        period={sources.vegetation.period ?? analysis.period}
        dict={dict}
        layout={layout}
      />
    ) : null,
    terrain: sources?.terrain?.data ? <SlopeClasses data={sources.terrain.data} dict={dict} layout={layout} /> : null,
    soil: sources?.soil?.data ? <SoilTable data={sources.soil.data} dict={dict} /> : null,
    climate: sources?.climate?.data ? <ClimateTable data={sources.climate.data} dict={dict} /> : null,
  };

  const card = (source: SourceId) => {
    const result = sources?.[source];
    const title = layout.sources[source];
    if (!result) {
      return (
        <article key={source} className="row-span-4 flex flex-col gap-3 bg-white p-5">
          <h3 className="font-display text-h3 uppercase">{title}</h3>
          <p className="text-body">{layout.dashboard.sourceAbsent}</p>
        </article>
      );
    }
    return (
      <SourceCard
        key={source}
        result={result}
        title={title}
        icon={SOURCE_ICONS[source]}
        messages={messages(source)}
        areaKind={areaKind}
        sentences={buildReport({ result, areaKind, locale: dict.locale, dict: report, slopeClassNames: dict.terrain.classes })}
        note={source === "climate" && mismatch ? <ElevationNote mismatch={mismatch} dict={dict} /> : null}
        detail={details[source]}
        retrying={retrying.includes(source)}
        onRetry={() => onRetry(source)}
        dict={dict}
        layout={layout}
        report={report}
      />
    );
  };

  return (
    <section aria-labelledby={titleId} lang={dict.locale} className="@container flex h-full flex-col bg-paper text-ink">
      <ScannedPlot
        analysis={analysis}
        sourceTitles={sourceTitles}
        titleId={titleId}
        headingRef={headingRef}
        actions={plotActions}
        dict={dict}
        report={report}
      />
      <div className="@container relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex max-w-6xl flex-col gap-14 px-4 pt-8 pb-16 @xl:px-6">
          {reading}

          <section aria-labelledby={dataId} className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h2 id={dataId} className="font-display text-title font-normal uppercase">
                {layout.dashboard.dataHeading}
              </h2>
              <p className="max-w-[70ch] text-body text-muted">{layout.dashboard.dataIntro}</p>
            </div>
            <div className="grid gap-x-5 gap-y-5 @2xl:grid-cols-2 @6xl:grid-cols-3">{SOURCE_IDS.map(card)}</div>
          </section>

          {advice}

          {rotations ? (
            <ToolSection title={layout.rotations.title} note={layout.rotations.note}>
              {rotations}
            </ToolSection>
          ) : null}
        </div>
      </div>
    </section>
  );
}
