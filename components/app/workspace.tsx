"use client";

// Contract: Workspace
// Props: locale (Locale, required) — language of every word on the screen
// Variants: none
// States: idle (form and map) | invalid (messages next to the fields) | loading (seed
//         loader over the map; editing the selection cancels it) | error (explanation
//         with retry over the map) | results (form and map leave; the results take the whole
//         screen under the "Terreno escaneado" box; "Ver mapa" shows the map beside them) |
//         choosing another place ("Analizar otro terreno", or editing the selection: form and
//         map come back with a "Volver a los resultados" box; the results stay mounted, hidden)
//         | stale (the selection changed; the analysed area stays dashed on the map)
// Accessibility: header, then <main> (target of the skip link) with an h1; the loader
//                and the failure box cover the map only, so the form stays usable; focus
//                moves to the results heading or the failure box when they appear; the
//                outcome is announced in a polite live region
// Responsive: see workspace-layout.ts — choosing: one column below lg (intro, map, form),
//             form column and map from lg; results: full screen, with the map above (phones)
//             or beside (lg) when it is open

import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState } from "react";
import type { Place } from "@/lib/analysis/geocode-client";
import {
  INITIAL_DRAFT,
  checkSelection,
  draftReducer,
  isSameSelection,
  pointOf,
  type DraftAction,
  type SelectionDraft,
  type SelectionIssue,
} from "@/lib/analysis/selection";
import { SOURCE_MESSAGES } from "@/lib/analysis/sources/messages";
import type { AnalysisRequest, SourceId } from "@/lib/analysis/types";
import { formatCoordinate, formatValueWithUnit } from "@/lib/analysis/format";
import type { Analysis } from "@/lib/analysis/types";
import { fill, getResultsDictionary } from "@/lib/i18n/app/results";
import { getReportDictionary } from "@/lib/i18n/app/report";
import { getWorkspaceDictionary, type WorkspaceDictionary } from "@/lib/i18n/app/workspace";
import { SECTION_ID, type Locale } from "@/lib/site";
import { FailureOverlay, LoadingOverlay } from "./analysis-overlay";
import type { AnalysisState } from "./analysis-state";
import { AppHeader } from "./app-header";
import { DownloadReportButton } from "./download-report-button";
import { AdvicePanel } from "./explain/advice-panel";
import { TerrainReading } from "./explain/terrain-reading";
import { getResultsLayoutDictionary } from "@/lib/i18n/app/results-layout";
import { LocationForm } from "./location-form";
import { toLoaderView } from "./loader-view";
import { outlineOf, squareOf } from "./map-shapes";
import { PixelButton } from "./pixel-button";
import type { MapViewRequest } from "./plot-map";
import { ResultsDock } from "./results-dock";
import { ResultsPanel } from "./results-panel";
import { RotationExplorer } from "./rotations/rotation-explorer";
import { SeedLoader } from "./seed-loader";
import { useAnalysis } from "./use-analysis";
import { layoutOf } from "./workspace-layout";

// Leaflet reads `window` when it is imported, so the map only exists in the browser.
const PlotMap = dynamic(() => import("./plot-map").then((module) => module.PlotMap), { ssr: false });

/** Zoom that shows a 200 m square clearly once a coordinate is typed. */
const POINT_ZOOM = 16;
/** Zoom for a searched place: a town and its surroundings. */
const PLACE_ZOOM = 14;
/** Same breakpoint as the results dock (lg). */
const WIDE_SCREEN = "(min-width: 64rem)";

interface WorkspaceProps {
  readonly locale: Locale;
}

/** Actions that type or paste a coordinate: the map follows them, a click does not. */
const MOVES_MAP: ReadonlySet<DraftAction["type"]> = new Set(["latitude-typed", "longitude-typed", "point-set"]);

/** True when the draft no longer asks for what `request` asked. */
function differsFrom(draft: SelectionDraft, request: AnalysisRequest | null): boolean {
  if (!request) return false;
  const check = checkSelection(draft);
  return !check.ok || !isSameSelection(check.request, request);
}

function retryFailureText(state: AnalysisState, dict: WorkspaceDictionary, locale: Locale): string | null {
  if (!state.retryFailure) return null;
  const names = state.retryFailure.sources.map((id: SourceId) => SOURCE_MESSAGES[id][locale].title);
  return fill(dict.results.retryFailed, { sources: names.join(", ") });
}

function announcementOf(state: AnalysisState, cancelled: boolean, dict: WorkspaceDictionary): string {
  const words = dict.announcements;
  if (state.phase === "done" && state.analysis) return words.done[state.analysis.status];
  if (state.phase === "error") return words.error;
  if (state.phase === "idle" && cancelled) return words.cancelled;
  return "";
}

/** "Lat 10.95, Lon -84.72 · 4 ha": what was analysed, named while another place is chosen. */
function reminderOf(analysis: Analysis, dict: WorkspaceDictionary, locale: Locale): string {
  const missing = getResultsDictionary(locale).missing;
  return fill(dict.results.reminder, {
    lat: formatCoordinate(analysis.area?.center?.lat) ?? missing,
    lon: formatCoordinate(analysis.area?.center?.lon) ?? missing,
    area: formatValueWithUnit(analysis.area?.areaHectares, "ha", locale) ?? missing,
  });
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function Workspace({ locale }: WorkspaceProps) {
  const dict = getWorkspaceDictionary(locale);
  const { state, start, retrySource, reset, dismissRetryFailure } = useAnalysis();
  const [draft, setDraft] = useState<SelectionDraft>(INITIAL_DRAFT);
  const [showIssues, setShowIssues] = useState(false);
  const [view, setView] = useState<MapViewRequest | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  // The analysis for which the person asked to see the map, and the one for which they went
  // back to the form to choose another place. A new result has another id (or arrives after
  // `begin` cleared both), so results take the whole screen by themselves when they arrive.
  const [mapOpenFor, setMapOpenFor] = useState<string | null>(null);
  const [choosingFor, setChoosingFor] = useState<string | null>(null);
  const titleId = useId();
  const introRef = useRef<HTMLHeadingElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const failureRef = useRef<HTMLDivElement>(null);

  const check = checkSelection(draft);
  const issues: readonly SelectionIssue[] = showIssues && !check.ok ? check.issues : [];
  const loading = state.phase === "loading";
  const analysis = state.phase === "done" ? state.analysis : null;
  const stale = analysis !== null && differsFrom(draft, state.request);
  const resultsMode = analysis !== null && choosingFor !== analysis.id;
  const mapInResults = resultsMode && mapOpenFor === analysis.id;
  const layout = layoutOf(resultsMode, mapInResults);
  const report = getReportDictionary(locale);
  /** Topic names for the AI blocks, the same the data cards use. */
  const sourceNames = getResultsLayoutDictionary(locale).sources;
  /** Choosing another place brings the form and the map back. */
  const chooseAnother = () => setChoosingFor(analysis?.id ?? null);

  // Results and failures take focus when they appear, so they are read out first.
  useEffect(() => {
    if (state.phase === "done") headingRef.current?.focus({ preventScroll: true });
    if (state.phase === "error") failureRef.current?.focus();
  }, [state.phase]);

  const moveMap = (center: { lat: number; lon: number }, zoom: number, zoomMode: MapViewRequest["zoomMode"]) =>
    setView((previous) => ({ center, zoom, zoomMode, token: (previous?.token ?? 0) + 1 }));

  const cancel = () => {
    reset();
    setCancelled(true);
  };

  const handleAction = (action: DraftAction) => {
    const next = draftReducer(draft, action);
    setDraft(next);
    // Choosing another place needs the form and the map.
    chooseAnother();
    // Editing the selection while it is being analysed stops that analysis.
    if (loading && differsFrom(next, state.request)) cancel();
    if (!MOVES_MAP.has(action.type)) return;
    const before = pointOf(draft);
    const after = pointOf(next);
    if (after && (after.lat !== before?.lat || after.lon !== before?.lon)) moveMap(after, POINT_ZOOM, "at-least");
  };

  const handlePlaceChosen = (place: Place) => {
    chooseAnother();
    moveMap({ lat: place.lat, lon: place.lon }, PLACE_ZOOM, "exact");
  };

  const begin = (request: AnalysisRequest) => {
    setCancelled(false);
    setMapOpenFor(null);
    setChoosingFor(null);
    start(request);
    // On a phone the map (and its loader) sits above the form: bring it into view.
    if (!window.matchMedia(WIDE_SCREEN).matches) {
      mapRef.current?.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
  };

  const handleSubmit = (): readonly SelectionIssue[] => {
    if (!check.ok) {
      setShowIssues(true);
      return check.issues;
    }
    setShowIssues(false);
    begin(check.request);
    return [];
  };

  const handleRetry = () => {
    if (state.request) begin(state.request);
  };

  const analyseAnother = () => {
    chooseAnother();
    introRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  };

  const announcement = announcementOf(state, cancelled, dict);

  return (
    <div className={layout.root}>
      <AppHeader dict={dict.header} locale={locale} />

      <main id={SECTION_ID.content} className={layout.main}>
        <div className={layout.intro}>
          <h1
            ref={introRef}
            tabIndex={-1}
            className="font-display text-title font-normal tracking-display uppercase"
          >
            {dict.intro.title}
          </h1>
          <p className="mt-1 max-w-prose text-small text-muted">{dict.intro.body}</p>
        </div>

        {/* Below lg the map comes first on screen; the form stays first in the reading order. */}
        <div className={layout.form}>
          {analysis && !resultsMode ? (
            <div className="mb-4 flex flex-col items-start gap-2 border border-ink bg-white p-3">
              <p className="text-small">
                {fill(report.plot.backNote, { coordinates: reminderOf(analysis, dict, locale) })}
              </p>
              <PixelButton size="sm" onClick={() => setChoosingFor(null)}>
                {report.plot.backToResults}
              </PixelButton>
            </div>
          ) : null}
          <LocationForm
            dict={dict}
            locale={locale}
            draft={draft}
            issues={issues}
            busy={loading}
            onAction={handleAction}
            onPlaceChosen={handlePlaceChosen}
            onSubmit={handleSubmit}
          />
        </div>

        <div ref={mapRef} className={layout.map}>
          {mapReady ? null : (
            <p className="absolute inset-0 grid place-items-center font-mono text-label tracking-label uppercase">
              {dict.map.loading}
            </p>
          )}
          <PlotMap
            labels={dict.map}
            mode={draft.mode}
            point={pointOf(draft)}
            square={squareOf(draft, dict.map, locale)}
            outline={outlineOf(draft, dict.map, locale)}
            analysedRing={stale && analysis ? analysis.area.polygon.coordinates[0] : null}
            view={view}
            onPick={(point) => handleAction({ type: "map-picked", point })}
            onFinishOutline={() => handleAction({ type: "outline-finished" })}
            onReady={() => setMapReady(true)}
            className="absolute inset-0"
          />

          {loading ? (
            <LoadingOverlay label={dict.loader.regionLabel} cancelLabel={dict.loader.cancel} onCancel={cancel}>
              <SeedLoader {...toLoaderView(state, locale, dict.loader)} />
            </LoadingOverlay>
          ) : null}

          {state.phase === "error" && state.failure ? (
            <FailureOverlay
              ref={failureRef}
              dict={dict.failure}
              failure={state.failure}
              onRetry={handleRetry}
              onDismiss={reset}
            />
          ) : null}
        </div>

        {analysis ? (
          // Kept mounted while another place is chosen, so tabs and edits survive the trip.
          <ResultsDock
            key={analysis.id}
            dict={dict.results}
            labelledBy={titleId}
            stale={stale}
            onAnalyseNew={() => void handleSubmit()}
            retryFailure={retryFailureText(state, dict, locale)}
            onDismissRetryFailure={dismissRetryFailure}
            className={layout.results}
          >
            <ResultsPanel
              analysis={analysis}
              locale={locale}
              onRetry={retrySource}
              retrying={state.retrying}
              titleId={titleId}
              headingRef={headingRef}
              plotActions={
                <>
                  <PixelButton size="sm" aria-pressed={mapInResults} onClick={() => setMapOpenFor(mapInResults ? null : analysis.id)}>
                    {mapInResults ? dict.results.hideMap : dict.results.showMap}
                  </PixelButton>
                  {state.request ? <DownloadReportButton request={state.request} locale={locale} /> : null}
                  <PixelButton size="sm" variant="accent" withArrow onClick={analyseAnother}>
                    {report.plot.analyseAnother}
                  </PixelButton>
                </>
              }
              reading={
                state.request ? (
                  <TerrainReading key={`reading-${analysis.id}`} request={state.request} locale={locale} sourceNames={sourceNames} />
                ) : null
              }
              advice={
                state.request ? (
                  <AdvicePanel key={`advice-${analysis.id}`} request={state.request} locale={locale} sourceNames={sourceNames} />
                ) : null
              }
              rotations={<RotationExplorer analysis={analysis} locale={locale} />}
            />
          </ResultsDock>
        ) : null}

        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </main>
    </div>
  );
}
