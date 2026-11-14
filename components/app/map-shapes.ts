import { formatNumber } from "@/lib/analysis/format";
import { squareAround } from "@/lib/analysis/geometry";
import { outlineAreaHectares, pointOf, type SelectionDraft } from "@/lib/analysis/selection";
import { fill } from "@/lib/i18n/app/results";
import type { WorkspaceDictionary } from "@/lib/i18n/app/workspace";
import type { Locale } from "@/lib/site";
import type { MapOutline, MapSquare } from "./plot-map";

/**
 * The shapes the map draws for the selection being edited, with their sizes in
 * words. Pure: derived from the draft only, so the map and the form always
 * describe the same area.
 */

/** Square metres in a hectare. */
const SQUARE_METERS_PER_HECTARE = 10_000;
/** Outline areas are shown to two decimals: a hundredth of a hectare is 100 m². */
const OUTLINE_AREA_DECIMALS = 2;

type MapWords = WorkspaceDictionary["map"];

export function squareOf(draft: SelectionDraft, words: MapWords, locale: Locale): MapSquare | null {
  if (draft.mode !== "buffer") return null;
  const center = pointOf(draft);
  if (!center) return null;
  const hectares = draft.sideMeters ** 2 / SQUARE_METERS_PER_HECTARE;
  const area = formatNumber(hectares, locale, Number.isInteger(hectares) ? 0 : 2) ?? "";
  return {
    ring: squareAround(center, draft.sideMeters),
    label: fill(words.squareLabel, { side: draft.sideMeters, area }),
  };
}

export function outlineOf(draft: SelectionDraft, words: MapWords, locale: Locale): MapOutline | null {
  if (draft.mode !== "polygon" || draft.vertices.length === 0) return null;
  const hectares = outlineAreaHectares(draft.vertices);
  const area = formatNumber(hectares, locale, OUTLINE_AREA_DECIMALS);
  return {
    vertices: draft.vertices,
    finished: draft.outlineFinished,
    label: area === null ? null : fill(words.outlineLabel, { area }),
  };
}
