import { describe, expect, it } from "vitest";
import { parseAnalysisRequest } from "./schema";
import {
  INITIAL_DRAFT,
  canFinishOutline,
  checkSelection,
  draftReducer,
  isSameSelection,
  outlineAreaHectares,
  outlineRing,
  pointOf,
  type DraftAction,
  type SelectionDraft,
} from "./selection";
import { ANALYSIS_LIMITS, type LatLon } from "./types";

const LOS_CHILES: LatLon = { lat: 10.95, lon: -84.72 };

/** Corners of a square of about 200 m, counter-clockwise from the south-west. */
const SQUARE: readonly LatLon[] = [
  { lat: 10.949, lon: -84.721 },
  { lat: 10.949, lon: -84.719 },
  { lat: 10.951, lon: -84.719 },
  { lat: 10.951, lon: -84.721 },
];

function apply(draft: SelectionDraft, ...actions: readonly DraftAction[]): SelectionDraft {
  return actions.reduce(draftReducer, draft);
}

function outlineDraft(vertices: readonly LatLon[]): SelectionDraft {
  return { ...INITIAL_DRAFT, mode: "polygon", vertices };
}

describe("draftReducer", () => {
  it("starts with the default square size and history length", () => {
    expect(INITIAL_DRAFT.sideMeters).toBe(ANALYSIS_LIMITS.defaultBufferSideMeters);
    expect(INITIAL_DRAFT.years).toBe(ANALYSIS_LIMITS.defaultYears);
  });

  it("keeps typed text as it is, even when it is not a number yet", () => {
    const draft = apply(INITIAL_DRAFT, { type: "latitude-typed", text: "10." });
    expect(draft.latitudeText).toBe("10.");
    expect(pointOf(draft)).toBeNull();
  });

  it("writes a clicked point into both fields with five decimals", () => {
    const draft = apply(INITIAL_DRAFT, {
      type: "map-picked",
      point: { lat: 10.950004123, lon: -84.7199999 },
    });
    expect(draft.latitudeText).toBe("10.95000");
    expect(draft.longitudeText).toBe("-84.72000");
    expect(pointOf(draft)).toEqual(LOS_CHILES);
  });

  it("adds a corner per click in outline mode and leaves the fields alone", () => {
    const draft = apply(
      { ...INITIAL_DRAFT, mode: "polygon", latitudeText: "10.95" },
      { type: "map-picked", point: SQUARE[0] },
      { type: "map-picked", point: SQUARE[1] },
    );
    expect(draft.vertices).toEqual([SQUARE[0], SQUARE[1]]);
    expect(draft.latitudeText).toBe("10.95");
  });

  it("ignores a second click on a corner that already exists", () => {
    const draft = apply(
      outlineDraft([]),
      { type: "map-picked", point: SQUARE[0] },
      { type: "map-picked", point: { lat: SQUARE[0].lat + 0.000001, lon: SQUARE[0].lon } },
    );
    expect(draft.vertices).toHaveLength(1);
  });

  it("stops adding corners at the limit", () => {
    const full = Array.from({ length: ANALYSIS_LIMITS.maxPolygonVertices }, (_, index) => ({
      lat: 10 + index * 0.001,
      lon: -84,
    }));
    const draft = apply(outlineDraft(full), { type: "map-picked", point: LOS_CHILES });
    expect(draft.vertices).toHaveLength(ANALYSIS_LIMITS.maxPolygonVertices);
  });

  it("only finishes an outline that has three corners", () => {
    const two = outlineDraft(SQUARE.slice(0, 2));
    expect(canFinishOutline(two)).toBe(false);
    expect(apply(two, { type: "outline-finished" }).outlineFinished).toBe(false);

    const three = outlineDraft(SQUARE.slice(0, 3));
    expect(canFinishOutline(three)).toBe(true);
    expect(apply(three, { type: "outline-finished" }).outlineFinished).toBe(true);
  });

  it("does not add corners to a finished outline", () => {
    const finished = apply(outlineDraft(SQUARE), { type: "outline-finished" });
    const clicked = apply(finished, { type: "map-picked", point: LOS_CHILES });
    expect(clicked.vertices).toEqual(SQUARE);
  });

  it("undoes the finish first and then one corner at a time", () => {
    const finished = apply(outlineDraft(SQUARE), { type: "outline-finished" });
    const reopened = apply(finished, { type: "outline-undone" });
    expect(reopened.outlineFinished).toBe(false);
    expect(reopened.vertices).toEqual(SQUARE);
    expect(apply(reopened, { type: "outline-undone" }).vertices).toEqual(SQUARE.slice(0, 3));
  });

  it("undoing an empty outline changes nothing", () => {
    expect(apply(outlineDraft([]), { type: "outline-undone" }).vertices).toEqual([]);
  });

  it("clears the outline and keeps everything else", () => {
    const finished = apply(outlineDraft(SQUARE), { type: "outline-finished" }, { type: "years-chosen", years: 10 });
    const cleared = apply(finished, { type: "outline-cleared" });
    expect(cleared.vertices).toEqual([]);
    expect(cleared.outlineFinished).toBe(false);
    expect(cleared.years).toBe(10);
  });

  it("keeps the outline when the person switches mode and back", () => {
    const draft = apply(
      outlineDraft(SQUARE),
      { type: "mode-chosen", mode: "buffer" },
      { type: "mode-chosen", mode: "polygon" },
    );
    expect(draft.vertices).toEqual(SQUARE);
  });

  it("never modifies the draft it receives", () => {
    const draft = Object.freeze(outlineDraft(Object.freeze([...SQUARE])));
    expect(() => apply(draft, { type: "map-picked", point: LOS_CHILES })).not.toThrow();
    expect(draft.vertices).toHaveLength(SQUARE.length);
  });
});

describe("checkSelection with a square", () => {
  const typed = apply(INITIAL_DRAFT, { type: "point-set", point: LOS_CHILES });

  it("builds a request the backend accepts", () => {
    const check = checkSelection(typed);
    expect(check).toMatchObject({
      ok: true,
      request: { area: { kind: "buffer", center: LOS_CHILES, sideMeters: 200 }, years: 5 },
    });
    if (!check.ok) throw new Error("expected a valid selection");
    expect(check.area.areaHectares).toBeCloseTo(4, 6);
    expect(parseAnalysisRequest(check.request).ok).toBe(true);
  });

  it("reports each coordinate field on its own", () => {
    const check = checkSelection({ ...INITIAL_DRAFT, latitudeText: "", longitudeText: "-200" });
    expect(check).toEqual({
      ok: false,
      issues: [
        { field: "latitude", problem: "empty" },
        { field: "longitude", problem: "out-of-range" },
      ],
    });
  });

  it("reports text that is not a number", () => {
    const check = checkSelection({ ...typed, latitudeText: "diez" });
    expect(check).toEqual({ ok: false, issues: [{ field: "latitude", problem: "not-a-number" }] });
  });

  it("accepts every size and history length the form offers", () => {
    for (const sideMeters of ANALYSIS_LIMITS.bufferSidesMeters) {
      for (const years of ANALYSIS_LIMITS.yearsOptions) {
        const check = checkSelection({ ...typed, sideMeters, years });
        expect(check.ok).toBe(true);
        if (check.ok) expect(parseAnalysisRequest(check.request).ok).toBe(true);
      }
    }
  });
});

describe("checkSelection with an outline", () => {
  it("builds a closed ring the backend accepts, finished or not", () => {
    const check = checkSelection(outlineDraft(SQUARE));
    if (!check.ok) throw new Error("expected a valid selection");
    expect(check.request.area).toEqual({
      kind: "polygon",
      ring: [
        [-84.721, 10.949],
        [-84.719, 10.949],
        [-84.719, 10.951],
        [-84.721, 10.951],
        [-84.721, 10.949],
      ],
    });
    expect(check.area.kind).toBe("polygon");
    expect(parseAnalysisRequest(check.request).ok).toBe(true);
  });

  it("does not look at the coordinate fields", () => {
    expect(checkSelection({ ...outlineDraft(SQUARE), latitudeText: "abc" }).ok).toBe(true);
  });

  it("asks for at least three corners", () => {
    const issue = { ok: false, issues: [{ field: "outline", problem: "too-few-vertices" }] };
    expect(checkSelection(outlineDraft([]))).toEqual(issue);
    expect(checkSelection(outlineDraft(SQUARE.slice(0, 2)))).toEqual(issue);
  });

  it("rejects an outline that crosses itself", () => {
    const bowTie = [SQUARE[0], SQUARE[2], SQUARE[1], SQUARE[3]];
    expect(checkSelection(outlineDraft(bowTie))).toEqual({
      ok: false,
      issues: [{ field: "outline", problem: "self-intersecting" }],
    });
  });

  it("rejects an area below the minimum", () => {
    // About 11 m by 11 m: 0.012 ha.
    const tiny = [
      { lat: 10.95, lon: -84.72 },
      { lat: 10.95, lon: -84.7199 },
      { lat: 10.9501, lon: -84.7199 },
      { lat: 10.9501, lon: -84.72 },
    ];
    expect(checkSelection(outlineDraft(tiny))).toEqual({
      ok: false,
      issues: [{ field: "outline", problem: "area-too-small" }],
    });
  });

  it("rejects an area above the maximum", () => {
    // About 3.3 km by 3.3 km: over 1000 ha.
    const huge = [
      { lat: 10.93, lon: -84.74 },
      { lat: 10.93, lon: -84.71 },
      { lat: 10.96, lon: -84.71 },
      { lat: 10.96, lon: -84.74 },
    ];
    expect(checkSelection(outlineDraft(huge))).toEqual({
      ok: false,
      issues: [{ field: "outline", problem: "area-too-large" }],
    });
  });
});

describe("outline helpers", () => {
  it("has no area until three corners exist", () => {
    expect(outlineAreaHectares([])).toBeNull();
    expect(outlineAreaHectares(SQUARE.slice(0, 2))).toBeNull();
  });

  it("measures the area in hectares", () => {
    // 0.002° of latitude is 222.4 m; 0.002° of longitude at 10.95° N is 218.3 m.
    expect(outlineAreaHectares(SQUARE)).toBeCloseTo(4.856, 2);
  });

  it("writes rings longitude first and closed", () => {
    const ring = outlineRing(SQUARE.slice(0, 3));
    expect(ring).toHaveLength(4);
    expect(ring[0]).toEqual([-84.721, 10.949]);
    expect(ring[3]).toEqual(ring[0]);
  });
});

describe("isSameSelection", () => {
  const base = checkSelection(apply(INITIAL_DRAFT, { type: "point-set", point: LOS_CHILES }));
  if (!base.ok) throw new Error("expected a valid selection");

  it("ignores which sources are being refreshed", () => {
    expect(isSameSelection(base.request, { ...base.request, refresh: ["rain"] })).toBe(true);
  });

  it("notices a different point, size or history length", () => {
    const moved = { ...base.request, area: { kind: "buffer", center: { lat: 10.96, lon: -84.72 }, sideMeters: 200 } } as const;
    const resized = { ...base.request, area: { kind: "buffer", center: LOS_CHILES, sideMeters: 500 } } as const;
    expect(isSameSelection(base.request, moved)).toBe(false);
    expect(isSameSelection(base.request, resized)).toBe(false);
    expect(isSameSelection(base.request, { ...base.request, years: 10 })).toBe(false);
  });
});
