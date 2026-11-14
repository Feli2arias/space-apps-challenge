import { parseCoordinate, roundPoint, type CoordinateProblem } from "./coordinates";
import { formatCoordinate } from "./format";
import { bufferArea, closeRing, isSelfIntersecting, polygonArea } from "./geometry";
import {
  ANALYSIS_LIMITS,
  type AnalysisArea,
  type AnalysisRequest,
  type AreaKind,
  type LatLon,
  type Ring,
} from "./types";

/**
 * What the person has chosen on the screen before pressing "Analizar terreno",
 * and the rules that turn it into a request for the backend.
 *
 * The same limits are checked again by the server (lib/analysis/schema.ts);
 * checking them here first lets the form explain the problem next to the field
 * instead of after a round trip.
 */

export type BufferSide = (typeof ANALYSIS_LIMITS.bufferSidesMeters)[number];
export type HistoryYears = (typeof ANALYSIS_LIMITS.yearsOptions)[number];

export interface SelectionDraft {
  /** "buffer": a square around the point. "polygon": the outline drawn on the map. */
  readonly mode: AreaKind;
  /** The coordinate fields exactly as typed, so a half-written value is not lost. */
  readonly latitudeText: string;
  readonly longitudeText: string;
  readonly sideMeters: BufferSide;
  /** Corners of the outline, in the order they were clicked. Never closed. */
  readonly vertices: readonly LatLon[];
  /** True once the person pressed "finish": further clicks no longer add corners. */
  readonly outlineFinished: boolean;
  readonly years: HistoryYears;
}

export const INITIAL_DRAFT: SelectionDraft = {
  mode: "buffer",
  latitudeText: "",
  longitudeText: "",
  sideMeters: ANALYSIS_LIMITS.defaultBufferSideMeters,
  vertices: [],
  outlineFinished: false,
  years: ANALYSIS_LIMITS.defaultYears,
};

export type DraftAction =
  | { readonly type: "latitude-typed"; readonly text: string }
  | { readonly type: "longitude-typed"; readonly text: string }
  /** A whole pair arrived at once: pasted in a field or chosen from a list. */
  | { readonly type: "point-set"; readonly point: LatLon }
  /** The map was clicked. What it means depends on the mode. */
  | { readonly type: "map-picked"; readonly point: LatLon }
  | { readonly type: "mode-chosen"; readonly mode: AreaKind }
  | { readonly type: "side-chosen"; readonly sideMeters: BufferSide }
  | { readonly type: "years-chosen"; readonly years: HistoryYears }
  | { readonly type: "outline-undone" }
  | { readonly type: "outline-finished" }
  | { readonly type: "outline-cleared" };

function withPoint(draft: SelectionDraft, point: LatLon): SelectionDraft {
  const rounded = roundPoint(point);
  return {
    ...draft,
    latitudeText: formatCoordinate(rounded.lat) ?? "",
    longitudeText: formatCoordinate(rounded.lon) ?? "",
  };
}

function withVertex(draft: SelectionDraft, point: LatLon): SelectionDraft {
  if (draft.outlineFinished || draft.vertices.length >= ANALYSIS_LIMITS.maxPolygonVertices) {
    return draft;
  }
  const vertex = roundPoint(point);
  // A double click lands twice on the same spot; one corner is enough.
  const isRepeated = draft.vertices.some(
    (existing) => existing.lat === vertex.lat && existing.lon === vertex.lon,
  );
  return isRepeated ? draft : { ...draft, vertices: [...draft.vertices, vertex] };
}

function undoOutline(draft: SelectionDraft): SelectionDraft {
  // The last thing done to a finished outline was finishing it, so that is undone first.
  if (draft.outlineFinished) return { ...draft, outlineFinished: false };
  return { ...draft, vertices: draft.vertices.slice(0, -1) };
}

export function canFinishOutline(draft: SelectionDraft): boolean {
  return !draft.outlineFinished && draft.vertices.length >= ANALYSIS_LIMITS.minPolygonVertices;
}

/** Returns the draft after one thing the person did. The input is never modified. */
export function draftReducer(draft: SelectionDraft, action: DraftAction): SelectionDraft {
  switch (action.type) {
    case "latitude-typed":
      return { ...draft, latitudeText: action.text };
    case "longitude-typed":
      return { ...draft, longitudeText: action.text };
    case "point-set":
      return withPoint(draft, action.point);
    case "map-picked":
      return draft.mode === "buffer" ? withPoint(draft, action.point) : withVertex(draft, action.point);
    case "mode-chosen":
      return { ...draft, mode: action.mode };
    case "side-chosen":
      return { ...draft, sideMeters: action.sideMeters };
    case "years-chosen":
      return { ...draft, years: action.years };
    case "outline-undone":
      return undoOutline(draft);
    case "outline-finished":
      return canFinishOutline(draft) ? { ...draft, outlineFinished: true } : draft;
    case "outline-cleared":
      return { ...draft, vertices: [], outlineFinished: false };
  }
}

/** The point written in the coordinate fields, when both are usable. */
export function pointOf(draft: SelectionDraft): LatLon | null {
  const latitude = parseCoordinate(draft.latitudeText, "latitude");
  const longitude = parseCoordinate(draft.longitudeText, "longitude");
  return latitude.ok && longitude.ok ? { lat: latitude.value, lon: longitude.value } : null;
}

/** The clicked corners as a closed GeoJSON ring (longitude first). */
export function outlineRing(vertices: readonly LatLon[]): Ring {
  return closeRing(vertices.map((vertex) => [vertex.lon, vertex.lat] as const));
}

/** Area of the outline drawn so far. `null` until there are enough corners to enclose one. */
export function outlineAreaHectares(vertices: readonly LatLon[]): number | null {
  if (vertices.length < ANALYSIS_LIMITS.minPolygonVertices) return null;
  return polygonArea(outlineRing(vertices)).areaHectares;
}

export type OutlineProblem =
  | "too-few-vertices"
  | "too-many-vertices"
  | "self-intersecting"
  | "area-too-small"
  | "area-too-large";

export type SelectionIssue =
  | { readonly field: "latitude" | "longitude"; readonly problem: CoordinateProblem }
  | { readonly field: "outline"; readonly problem: OutlineProblem };

export type SelectionCheck =
  | { readonly ok: true; readonly request: AnalysisRequest; readonly area: AnalysisArea }
  | { readonly ok: false; readonly issues: readonly SelectionIssue[] };

function checkBuffer(draft: SelectionDraft): SelectionCheck {
  const latitude = parseCoordinate(draft.latitudeText, "latitude");
  const longitude = parseCoordinate(draft.longitudeText, "longitude");
  if (!latitude.ok || !longitude.ok) {
    const issues: SelectionIssue[] = [];
    if (!latitude.ok) issues.push({ field: "latitude", problem: latitude.problem });
    if (!longitude.ok) issues.push({ field: "longitude", problem: longitude.problem });
    return { ok: false, issues };
  }
  const center: LatLon = { lat: latitude.value, lon: longitude.value };
  return {
    ok: true,
    request: {
      area: { kind: "buffer", center, sideMeters: draft.sideMeters },
      years: draft.years,
    },
    area: bufferArea(center, draft.sideMeters),
  };
}

function outlineProblemOf(vertices: readonly LatLon[], area: AnalysisArea): OutlineProblem | null {
  if (vertices.length > ANALYSIS_LIMITS.maxPolygonVertices) return "too-many-vertices";
  if (isSelfIntersecting(area.polygon.coordinates[0])) return "self-intersecting";
  if (area.areaHectares < ANALYSIS_LIMITS.minAreaHectares) return "area-too-small";
  if (area.areaHectares > ANALYSIS_LIMITS.maxAreaHectares) return "area-too-large";
  return null;
}

function checkOutline(draft: SelectionDraft): SelectionCheck {
  if (draft.vertices.length < ANALYSIS_LIMITS.minPolygonVertices) {
    return { ok: false, issues: [{ field: "outline", problem: "too-few-vertices" }] };
  }
  const ring = outlineRing(draft.vertices);
  const area = polygonArea(ring);
  const problem = outlineProblemOf(draft.vertices, area);
  if (problem) return { ok: false, issues: [{ field: "outline", problem }] };
  return {
    ok: true,
    request: { area: { kind: "polygon", ring }, years: draft.years },
    area,
  };
}

/**
 * Checks the selection and, when it is valid, builds the request and the area
 * that will be analysed. In outline mode the coordinate fields are only a way
 * to move the map, so they are not checked.
 */
export function checkSelection(draft: SelectionDraft): SelectionCheck {
  return draft.mode === "buffer" ? checkBuffer(draft) : checkOutline(draft);
}

/**
 * True when two requests ask about the same area and period. `refresh` is left
 * out: it changes where the answer comes from, not what is being asked.
 */
export function isSameSelection(first: AnalysisRequest, second: AnalysisRequest): boolean {
  return (
    first.years === second.years && JSON.stringify(first.area) === JSON.stringify(second.area)
  );
}
