// Contract: ScopeTag
// Props: scope (DataScope | null, required) — what the source's numbers describe
//        areaKind (AreaKind, required) — a drawn outline or a square around a point; it
//          changes how "parcel" is named, because a square is not a farm's boundary
//        dict (ResultsDictionary, required) — for the spoken "these numbers describe"
//        layout (ResultsLayoutDictionary, required) — the two-word names
// Variants: parcel (cinnabar block) | pixel (white, ink border) | regional (ink block) |
//           unknown (mist, dashed border) — different fills AND different icons
// States: static
// Accessibility: the scope is always written in words ("La región"); a screen reader hears
//                "Estos números describen: La región". Icon and colour only reinforce it.
//                Ink on cinnabar 6.3:1, white on ink 17:1.
// Responsive: an inline tag that never wraps inside; it moves to its own line when the row
//             is too narrow
// The full sentence for each scope lives in `scopeSentence`, shown on demand by the caller.

import type { AreaKind, DataScope } from "@/lib/analysis/types";
import type { ResultsDictionary } from "@/lib/i18n/app/results";
import type { ResultsLayoutDictionary } from "@/lib/i18n/app/results-layout";
import { cn } from "@/lib/cn";
import { BitmapIcon, RESULT_ICONS, type ResultIconName } from "./bitmap-icon";

interface ScopeTagProps {
  readonly scope: DataScope | null;
  readonly areaKind: AreaKind;
  readonly dict: ResultsDictionary;
  readonly layout: ResultsLayoutDictionary;
}

type ScopeLook = "parcel" | "pixel" | "regional" | "unknown";

const LOOK_ICONS: Readonly<Record<ScopeLook, ResultIconName>> = {
  parcel: "scopeParcel",
  pixel: "scopePixel",
  regional: "scopeRegional",
  unknown: "scopeUnknown",
};

const BOX_CLASSES: Readonly<Record<ScopeLook, string>> = {
  parcel: "border-ink bg-cinnabar text-ink",
  pixel: "border-ink bg-white text-ink",
  regional: "border-ink bg-ink text-white",
  unknown: "border-dashed border-ink bg-mist text-ink",
};

function lookFor(scope: DataScope | null): ScopeLook {
  return scope === "parcel" || scope === "pixel" || scope === "regional" ? scope : "unknown";
}

type ScopeKey = "parcelPolygon" | "parcelBuffer" | "pixel" | "regional" | "unknown";

function keyFor(scope: DataScope | null, areaKind: AreaKind): ScopeKey {
  const look = lookFor(scope);
  if (look !== "parcel") return look;
  return areaKind === "polygon" ? "parcelPolygon" : "parcelBuffer";
}

/** The panel's generic sentence for a scope, used when the source has none of its own. */
export function scopeSentence(scope: DataScope | null, areaKind: AreaKind, dict: ResultsDictionary): string {
  return dict.scope[keyFor(scope, areaKind)].sentence;
}

export function ScopeTag({ scope, areaKind, dict, layout }: ScopeTagProps) {
  const look = lookFor(scope);

  return (
    <span
      data-scope={look}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 border px-1.5 py-0.5 font-mono text-label tracking-label whitespace-nowrap uppercase",
        BOX_CLASSES[look],
      )}
    >
      <BitmapIcon bitmap={RESULT_ICONS[LOOK_ICONS[look]]} className="size-3.5" />
      <span className="sr-only">{dict.scope.heading}: </span>
      {layout.scopeShort[keyFor(scope, areaKind)]}
    </span>
  );
}
