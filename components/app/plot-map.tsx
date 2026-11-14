"use client";

// Contract: PlotMap
// Props: labels (WorkspaceDictionary["map"], required) — translated text
//        mode (AreaKind, required) — "buffer": a click chooses the point; "polygon": a click
//          marks a corner. It only changes the hint and how the point is drawn.
//        point (LatLon | null, required) — the point written in the form
//        square (MapSquare | null, required) — the query square and its size label
//        outline (MapOutline | null, required) — corners of the drawn outline, whether it
//          is finished, and its area label
//        analysedRing (Ring | null, required) — outline of the analysis on screen, drawn
//          dashed, when the selection has changed since
//        view (MapViewRequest | null, required) — "move the map here"; acted on each time
//          its token changes
//        onPick ((point: LatLon) => void, required) — the map was clicked or tapped
//        onFinishOutline (() => void, required) — the first corner was activated
//        onReady (() => void, required) — the map exists and can be used
//        className (string, optional)
// Variants: base layer "satellite" (Sentinel-2 cloudless mosaic) | "streets" (OpenStreetMap)
// States: empty (no point or corners yet) | point with square | outline in progress
//         (dashed, corners marked) | outline finished (solid) | earlier analysis shown
//         dashed. Tiles that fail to load leave the mist background; the form still works.
// Accessibility: the map is one focusable region with a translated label; arrow keys pan
//                and +/- zoom (Leaflet's keyboard support). Choosing a point by keyboard is
//                done in the form, which is the complete non-pointer path for the square
//                mode; drawing an outline needs a pointer or touch. Zoom and layer buttons
//                are real buttons of at least 44px with translated names. Shapes carry
//                their size as text labels, never colour alone. The providers' required
//                credits are always visible. Map animations are off under
//                prefers-reduced-motion (read when the map is created).
// Responsive: fills the box it is given and follows its size; labels and credits wrap

import L from "leaflet";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { AreaKind, LatLon, Ring } from "@/lib/analysis/types";
import { cn } from "@/lib/cn";
import type { WorkspaceDictionary } from "@/lib/i18n/app/workspace";
import "leaflet/dist/leaflet.css";
import "./plot-map.css";

export interface MapSquare {
  readonly ring: Ring;
  /** Its size in words, e.g. "200 m × 200 m · 4 ha". */
  readonly label: string;
}

export interface MapOutline {
  readonly vertices: readonly LatLon[];
  readonly finished: boolean;
  /** Its area in words. `null` until there are enough corners to enclose one. */
  readonly label: string | null;
}

export interface MapViewRequest {
  readonly center: LatLon;
  readonly zoom: number;
  /** "at-least" keeps the current zoom when the person is already closer. */
  readonly zoomMode: "exact" | "at-least";
  /** Changes with every request, so asking twice for the same place still moves the map. */
  readonly token: number;
}

interface PlotMapProps {
  readonly labels: WorkspaceDictionary["map"];
  readonly mode: AreaKind;
  readonly point: LatLon | null;
  readonly square: MapSquare | null;
  readonly outline: MapOutline | null;
  readonly analysedRing: Ring | null;
  readonly view: MapViewRequest | null;
  readonly onPick: (point: LatLon) => void;
  readonly onFinishOutline: () => void;
  readonly onReady: () => void;
  readonly className?: string;
}

type BaseLayerId = "satellite" | "streets";

/** Los Chiles, Alajuela, in northern Costa Rica: the area of the pilot. */
const INITIAL_VIEW = { center: [10.95, -84.72] as L.LatLngTuple, zoom: 13 };
const MIN_ZOOM = 3;
const MAX_ZOOM = 18;
/** Corners needed before an outline encloses an area. */
const MIN_CORNERS_FOR_AREA = 3;

/**
 * Base layers. URLs, zoom levels and credits were checked on each provider's
 * own pages and capabilities document on 2026-11-14:
 *
 * - Sentinel-2 cloudless 2025 by EOX, WMTS at tiles.maps.eox.at (no key). Licence
 *   CC BY-NC-SA 4.0, free for non-commercial use with this exact credit
 *   (https://cloudless.eox.at/documentation/license). Sentinel-2 pixels are
 *   10 m, which is zoom 14 on this grid: closer zooms enlarge those tiles in
 *   the browser instead of asking the server to do it.
 * - OpenStreetMap standard tiles (no key). The tile usage policy
 *   (https://operations.osmfoundation.org/policies/tiles/) asks for this URL,
 *   a visible credit, normal browser caching and no bulk downloading.
 */
const BASE_LAYERS: Readonly<Record<BaseLayerId, { readonly url: string; readonly options: L.TileLayerOptions }>> = {
  satellite: {
    url: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg",
    options: {
      maxNativeZoom: 14,
      className: "bts-tiles-satellite",
      attribution:
        '<a href="https://cloudless.eox.at">EOxCloudless https://cloudless.eox.at</a> by EOX IT Services GmbH ' +
        "(Contains modified Copernicus Sentinel data 2025) · " +
        '<a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a> · ' +
        '<a href="https://maps.eox.at">EOX::Maps</a>',
    },
  },
  streets: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
};

const LEAFLET_CREDIT = '<a href="https://leafletjs.com">Leaflet</a>';

interface MapParts {
  readonly map: L.Map;
  readonly base: Readonly<Record<BaseLayerId, L.TileLayer>>;
  readonly point: L.LayerGroup;
  readonly square: L.LayerGroup;
  readonly outline: L.LayerGroup;
  readonly analysed: L.LayerGroup;
  readonly animate: boolean;
}

const toLatLng = (point: LatLon): L.LatLngTuple => [point.lat, point.lon];
const ringToLatLngs = (ring: Ring): L.LatLngTuple[] => ring.map(([lon, lat]) => [lat, lon]);

/** Middle of the northern edge of a shape's bounding box: where its label hangs. */
function topCenter(latLngs: readonly L.LatLngTuple[]): L.LatLngTuple {
  const bounds = L.latLngBounds(latLngs.map((latLng) => L.latLng(latLng)));
  return [bounds.getNorth(), bounds.getCenter().lng];
}

/** A text label pinned to the map. The text is set as text, never as HTML. */
function textLabel(position: L.LatLngTuple, text: string): L.Tooltip {
  const content = document.createElement("span");
  content.textContent = text;
  return L.tooltip({ permanent: true, direction: "top", className: "bts-map-label", interactive: false })
    .setLatLng(position)
    .setContent(content);
}

function squareIcon(className: string, size: number): L.DivIcon {
  return L.divIcon({ className, html: "<span></span>", iconSize: [size, size] });
}

/** Area shapes never take clicks, so a click inside one still reaches the map. */
const AREA_STYLE: L.PolylineOptions = { interactive: false };

function createMap(container: HTMLDivElement, labels: WorkspaceDictionary["map"]): MapParts {
  const animate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const map = L.map(container, {
    center: INITIAL_VIEW.center,
    zoom: INITIAL_VIEW.zoom,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    zoomControl: false,
    // A double click would add two corners and zoom at once.
    doubleClickZoom: false,
    zoomAnimation: animate,
    fadeAnimation: animate,
    markerZoomAnimation: animate,
  });
  map.attributionControl.setPrefix(LEAFLET_CREDIT);
  L.control.zoom({ position: "topleft", zoomInTitle: labels.zoomIn, zoomOutTitle: labels.zoomOut }).addTo(map);

  const layer = (id: BaseLayerId) =>
    L.tileLayer(BASE_LAYERS[id].url, { maxZoom: MAX_ZOOM, ...BASE_LAYERS[id].options });
  // Added in drawing order: the earlier analysis below, the current selection on top.
  const group = () => L.layerGroup().addTo(map);
  const analysed = group();
  const square = group();
  const outline = group();
  const point = group();

  return { map, base: { satellite: layer("satellite"), streets: layer("streets") }, point, square, outline, analysed, animate };
}

function drawOutline(group: L.LayerGroup, outline: MapOutline, firstCornerTitle: string, onFinish: () => void): void {
  const latLngs = outline.vertices.map(toLatLng);
  const canFinish = !outline.finished && latLngs.length >= MIN_CORNERS_FOR_AREA;

  if (latLngs.length >= MIN_CORNERS_FOR_AREA) {
    const className = outline.finished ? "bts-area" : "bts-area bts-area--open";
    group.addLayer(L.polygon(latLngs, { ...AREA_STYLE, className }));
  } else if (latLngs.length === 2) {
    group.addLayer(L.polyline(latLngs, { ...AREA_STYLE, className: "bts-area bts-area--open" }));
  }

  latLngs.forEach((latLng, index) => {
    const isFinisher = index === 0 && canFinish;
    const marker = L.marker(latLng, {
      icon: isFinisher ? squareIcon("bts-vertex bts-vertex--first", 44) : squareIcon("bts-vertex", 14),
      interactive: isFinisher,
      keyboard: isFinisher,
      title: isFinisher ? firstCornerTitle : "",
    });
    if (isFinisher) marker.on("click", onFinish);
    group.addLayer(marker);
  });

  if (outline.label) group.addLayer(textLabel(topCenter(latLngs), outline.label));
}

export function PlotMap({
  labels,
  mode,
  point,
  square,
  outline,
  analysedRing,
  view,
  onPick,
  onFinishOutline,
  onReady,
  className,
}: PlotMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const partsRef = useRef<MapParts | null>(null);
  const [baseLayer, setBaseLayer] = useState<BaseLayerId>("satellite");

  const handlePick = useEffectEvent((latLng: L.LatLng) => {
    // Panning around the world gives longitudes beyond ±180; bring them back.
    const wrapped = latLng.wrap();
    onPick({ lat: wrapped.lat, lon: wrapped.lng });
  });
  const handleFinish = useEffectEvent(() => onFinishOutline());
  const handleReady = useEffectEvent(() => onReady());

  // Creates the map once and removes it with the component.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const parts = createMap(container, labels);
    partsRef.current = parts;
    parts.map.on("click", (event) => handlePick(event.latlng));

    // The box changes size when the results panel opens or the window resizes.
    const observer = new ResizeObserver(() => parts.map.invalidateSize({ animate: false }));
    observer.observe(container);
    handleReady();

    return () => {
      observer.disconnect();
      parts.map.remove();
      partsRef.current = null;
    };
    // The labels belong to the page's language, which never changes while it is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const parts = partsRef.current;
    if (!parts) return;
    const other: BaseLayerId = baseLayer === "satellite" ? "streets" : "satellite";
    parts.map.removeLayer(parts.base[other]);
    parts.base[baseLayer].addTo(parts.map);
  }, [baseLayer]);

  useEffect(() => {
    const group = partsRef.current?.point;
    if (!group) return;
    group.clearLayers();
    if (!point) return;
    // In outline mode the point is only where the form sent the map, not the area.
    const className = mode === "buffer" ? "bts-point" : "bts-point bts-point--reference";
    group.addLayer(L.marker(toLatLng(point), { icon: squareIcon(className, 22), interactive: false, keyboard: false }));
  }, [point, mode]);

  useEffect(() => {
    const group = partsRef.current?.square;
    if (!group) return;
    group.clearLayers();
    if (!square) return;
    const latLngs = ringToLatLngs(square.ring);
    group.addLayer(L.polygon(latLngs, { ...AREA_STYLE, className: "bts-area" }));
    group.addLayer(textLabel(topCenter(latLngs), square.label));
  }, [square]);

  useEffect(() => {
    const group = partsRef.current?.outline;
    if (!group) return;
    group.clearLayers();
    if (outline) drawOutline(group, outline, labels.firstCorner, () => handleFinish());
  }, [outline, labels.firstCorner]);

  useEffect(() => {
    const group = partsRef.current?.analysed;
    if (!group) return;
    group.clearLayers();
    if (!analysedRing) return;
    group.addLayer(L.polygon(ringToLatLngs(analysedRing), { ...AREA_STYLE, className: "bts-analysed" }));
  }, [analysedRing]);

  useEffect(() => {
    const parts = partsRef.current;
    if (!parts || !view) return;
    const zoom = view.zoomMode === "exact" ? view.zoom : Math.max(parts.map.getZoom(), view.zoom);
    parts.map.setView(toLatLng(view.center), zoom, { animate: parts.animate });
  }, [view]);

  return (
    <div className={cn("bts-map flex flex-col", className)}>
      <p className="flex flex-wrap justify-between gap-x-6 gap-y-1 bg-ink px-4 py-2 font-mono text-label tracking-label text-white uppercase">
        <span>{labels.hints[mode]}</span>
        {baseLayer === "satellite" ? <span className="text-on-ink-muted">{labels.satelliteNote}</span> : null}
      </p>

      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} role="region" aria-label={labels.ariaLabel} className="absolute inset-0" />

        <div
          role="group"
          aria-label={labels.layersLabel}
          className="absolute top-3 right-3 z-10 flex shadow-pixel-sm"
        >
          {(["satellite", "streets"] as const).map((id, index) => (
            <button
              key={id}
              type="button"
              aria-pressed={baseLayer === id}
              onClick={() => setBaseLayer(id)}
              className={cn(
                "min-h-11 cursor-pointer border border-ink px-3 font-mono text-label font-semibold tracking-label uppercase transition-colors",
                index > 0 && "-ml-px",
                baseLayer === id ? "bg-ink text-white" : "bg-white text-ink hover:bg-mist",
              )}
            >
              {labels[id]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
