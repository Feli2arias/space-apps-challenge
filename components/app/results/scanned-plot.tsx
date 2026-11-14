"use client";

// Contract: ScannedPlot ("Terreno escaneado")
// Props: analysis (Analysis, required) — area, period, status and sources
//        sourceTitles (Record<SourceId, string>, required) — names for the "missing" line
//        titleId (string, required) — id of the h2; the results are labelled by it
//        headingRef (Ref<HTMLHeadingElement>, optional) — the workspace focuses the heading
//          when results arrive
//        actions (ReactNode, optional) — "Ver mapa" and "Analizar otro terreno"
//        dict (ResultsDictionary, required), report (ReportDictionary, required)
// Variants: none
// States: place loading or failed (coordinates only, nothing blocks) | place found
//         ("Los Chiles, Alajuela, Costa Rica" with the OpenStreetMap attribution) | no known
//         place (open sea: coordinates only) | complete | partial / failed (a "Falta" line
//         naming each missing source and why)
// Accessibility: the h2 takes focus programmatically; the status is a word; the place name
//                arrives silently (it is not announced, it only adds context)
// Responsive: the workspace keeps it at the top while the tabs scroll below it; facts wrap;
//             the actions sit beside the facts from @3xl and below them on narrow panels;
//             content is centred at most 64rem wide

import type { ReactNode, Ref } from "react";
import { PixelIcon } from "@/components/ui/pixel-icon";
import type { PixelIconName } from "@/components/ui/pixel-icons";
import { formatCoordinate, formatDateRange, formatDistance, formatValueWithUnit } from "@/lib/analysis/format";
import type { Analysis, AnalysisStatus, SourceId } from "@/lib/analysis/types";
import { SOURCE_IDS } from "@/lib/analysis/types";
import type { ReportDictionary } from "@/lib/i18n/app/report";
import { fill, type ResultsDictionary } from "@/lib/i18n/app/results";
import { cn } from "@/lib/cn";
import { placeLine } from "./place";
import { useReversePlace } from "./use-reverse-place";
import { summariseSources } from "./view-model";

interface ScannedPlotProps {
  readonly analysis: Analysis;
  readonly sourceTitles: Readonly<Record<SourceId, string>>;
  readonly titleId: string;
  readonly headingRef?: Ref<HTMLHeadingElement>;
  readonly actions?: ReactNode;
  readonly dict: ResultsDictionary;
  readonly report: ReportDictionary;
}

const STATUS_ICONS: Readonly<Record<AnalysisStatus, PixelIconName>> = {
  complete: "check",
  partial: "modeled",
  failed: "cross",
};

const STATUS_CLASSES: Readonly<Record<AnalysisStatus, string>> = {
  complete: "border-ink bg-ink text-white",
  partial: "border-ink bg-cinnabar text-ink",
  failed: "border-ink text-ink",
};

function isStatus(value: unknown): value is AnalysisStatus {
  return value === "complete" || value === "partial" || value === "failed";
}

function areaWords(analysis: Analysis, dict: ResultsDictionary, report: ReportDictionary): string {
  if (analysis.area?.kind === "polygon") return report.plot.areaOutline;
  const side = formatDistance(analysis.area?.bufferSideMeters, dict.locale);
  return fill(report.plot.areaSquare, { side: side ?? dict.missing });
}

export function ScannedPlot({ analysis, sourceTitles, titleId, headingRef, actions, dict, report }: ScannedPlotProps) {
  const { locale } = dict;
  const center = analysis.area?.center;
  const place = useReversePlace(center?.lat, center?.lon, locale);
  const placeName = place.status === "done" ? placeLine(place.place) : null;
  const status: AnalysisStatus = isStatus(analysis.status) ? analysis.status : "partial";
  const summary = summariseSources(analysis);
  const lat = formatCoordinate(center?.lat);
  const lon = formatCoordinate(center?.lon);
  const coordinates = lat !== null && lon !== null ? fill(dict.header.coordinates, { lat, lon }) : dict.missing;
  // With no place name the coordinates are the title, so they are not repeated below it.
  const facts = [
    ...(placeName === null ? [] : [coordinates]),
    formatValueWithUnit(analysis.area?.areaHectares, "ha", locale) ?? dict.missing,
    areaWords(analysis, dict, report),
    formatDateRange(analysis.period, locale) ?? dict.missing,
  ];
  const missing = [
    ...summary.failed.map((id) => fill(dict.header.missingError, { source: sourceTitles[id] })),
    ...summary.noData.map((id) => fill(dict.header.missingNoData, { source: sourceTitles[id] })),
  ];

  return (
    <header className="shrink-0 border-b border-ink bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 @xl:px-6 @xl:py-4 @3xl:flex-row @3xl:items-end @3xl:justify-between @3xl:gap-8">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2
              id={titleId}
              ref={headingRef}
              tabIndex={-1}
              className="font-mono text-label font-semibold tracking-label text-cinnabar-deep uppercase"
            >
              {report.plot.title}
            </h2>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 border px-1.5 py-0.5 font-mono text-label tracking-label uppercase",
                STATUS_CLASSES[status],
              )}
            >
              <PixelIcon name={STATUS_ICONS[status]} className="size-2.5" />
              {dict.status[status].tag}
            </span>
            <span className="font-mono text-label tracking-label text-muted uppercase">
              {fill(dict.header.sourcesWithData, { count: summary.withData.length, total: SOURCE_IDS.length })}
            </span>
          </div>

          <p className="font-display text-h3 font-normal uppercase @xl:text-title">{placeName ?? coordinates}</p>
          {place.status === "loading" ? (
            <p className="text-small text-muted">{report.plot.placeLoading}</p>
          ) : place.status === "done" && placeName === null ? (
            <p className="text-small text-muted">{report.plot.noPlace}</p>
          ) : null}

          <p className="font-mono text-small text-muted">
            {facts.map((fact, index) => (
              <span key={fact + String(index)}>
                {index > 0 ? " · " : ""}
                <span className="whitespace-nowrap">{fact}</span>
              </span>
            ))}
          </p>

          {missing.length > 0 ? (
            <p className="text-small">
              <span className="font-mono text-label tracking-label text-cinnabar-deep uppercase">{report.plot.missing}: </span>
              {missing.join(" ")}
            </p>
          ) : null}

          {place.status === "done" && place.place.attribution ? (
            <p className="text-label text-muted">{fill(report.plot.placeSource, { attribution: place.place.attribution })}</p>
          ) : null}
        </div>

        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
