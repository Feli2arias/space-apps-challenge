"use client";

// Contract: LocationForm
// Props: dict (WorkspaceDictionary, required) — translated text (search and form sections)
//        locale (Locale, required) — language for numbers and for the place search
//        draft (SelectionDraft, required) — what is chosen so far; this form holds no copy
//        issues (readonly SelectionIssue[], required) — problems to show next to the fields;
//          the caller passes them only after a failed attempt, then keeps them up to date
//        busy (boolean, required) — an analysis is running
//        onAction ((action: DraftAction) => void, required) — one change to the draft; the
//          caller also moves the map when the change is a typed or pasted coordinate
//        onPlaceChosen ((place: Place) => void, required) — a searched place was picked
//        onSubmit (() => readonly SelectionIssue[], required) — "Analizar terreno" was
//          pressed; returns the problems found, empty when the analysis started
// Layout: four short blocks, no numbering: Lugar (search field + button), Coordenadas
//         (latitude and longitude side by side, one hint line, the rest behind "?"), Área
//         (Cuadrado | Contorno row, one hint line for the chosen mode, then the side row or
//         the outline tools), Historial (years row); then the "Analizar terreno" button.
// Variants: area mode "buffer" (side row; hint: a coordinate is a point, not a plot) |
//           "polygon" (outline tools; hint: how to mark the corners)
// States: default | invalid (messages next to each field, focus moves to the first one)
//         | busy (submit button says so and ignores presses; fields stay editable, and
//         editing them cancels the running analysis in the caller) | outline in progress,
//         finished or empty | help open (a "?" shows one more sentence). Loading and results
//         live outside this form.
// Accessibility: one <form> with a translated label, <fieldset>s with legends, native
//                inputs and radios, errors linked to their field and focused on submit;
//                the "?" toggles are buttons with aria-expanded; the outline's live corner
//                count and area sit in a polite live region; all targets are at least 44px.
//                The copy states that a coordinate is a point, not a plot, and that a drawn
//                outline is not a verified boundary. Tab order follows the visual order.
// Responsive: a single column at every width. Below lg the submit button sticks to the
//             bottom of the screen while the form is on it (paper band, so it never sits on
//             top of a field once the form is scrolled to its end); from lg it sits in the
//             flow, and the whole form fits in the column at 1280×720 and up.

import { useId, useRef, type ClipboardEvent, type FocusEvent, type FormEvent } from "react";
import { parseCoordinatePair } from "@/lib/analysis/coordinates";
import { formatNumber } from "@/lib/analysis/format";
import type { Place } from "@/lib/analysis/geocode-client";
import {
  type BufferSide,
  type DraftAction,
  type HistoryYears,
  type SelectionDraft,
  type SelectionIssue,
} from "@/lib/analysis/selection";
import { ANALYSIS_LIMITS, type AreaKind } from "@/lib/analysis/types";
import { fill } from "@/lib/i18n/app/results";
import type { WorkspaceDictionary } from "@/lib/i18n/app/workspace";
import type { Locale } from "@/lib/site";
import { HelpButton, HelpText, useHelpToggle } from "./results/help-toggle";
import { ChoiceRow, CoordinateField, HINT_CLASSES, SUB_LEGEND_CLASSES, type ChoiceOption } from "./form-controls";
import { OutlineTools } from "./outline-tools";
import { PixelButton } from "./pixel-button";
import { PlaceSearch } from "./place-search";

interface LocationFormProps {
  readonly dict: WorkspaceDictionary;
  readonly locale: Locale;
  readonly draft: SelectionDraft;
  readonly issues: readonly SelectionIssue[];
  readonly busy: boolean;
  readonly onAction: (action: DraftAction) => void;
  readonly onPlaceChosen: (place: Place) => void;
  readonly onSubmit: () => readonly SelectionIssue[];
}

/** Square metres in a hectare, to show the size of the query square. */
const SQUARE_METERS_PER_HECTARE = 10_000;
const AREA_MODES: readonly AreaKind[] = ["buffer", "polygon"];

type FormWords = WorkspaceDictionary["form"];

function coordinateError(
  issues: readonly SelectionIssue[],
  field: "latitude" | "longitude",
  words: FormWords,
): string | null {
  const issue = issues.find((candidate) => candidate.field === field);
  return issue && issue.field === field ? words.errors[field][issue.problem] : null;
}

function outlineError(issues: readonly SelectionIssue[], words: FormWords, locale: Locale): string | null {
  const issue = issues.find((candidate) => candidate.field === "outline");
  if (!issue || issue.field !== "outline") return null;
  return fill(words.errors.outline[issue.problem], {
    min: formatNumber(ANALYSIS_LIMITS.minAreaHectares, locale, 2) ?? "",
    max: formatNumber(ANALYSIS_LIMITS.maxAreaHectares, locale) ?? "",
    maxCorners: ANALYSIS_LIMITS.maxPolygonVertices,
  });
}

export function LocationForm({
  dict,
  locale,
  draft,
  issues,
  busy,
  onAction,
  onPlaceChosen,
  onSubmit,
}: LocationFormProps) {
  const { form } = dict;
  const baseId = useId();
  const latitudeRef = useRef<HTMLInputElement>(null);
  const longitudeRef = useRef<HTMLInputElement>(null);
  const outlineRef = useRef<HTMLDivElement>(null);
  const coordinateHelp = useHelpToggle();
  const coordinateHintId = `${baseId}-coordinates-hint`;
  const helpLabel = (topic: string) => fill(form.helpLabel, { topic });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const [first] = onSubmit();
    if (!first) return;
    // Focus goes to the first problem, so it is read out and easy to fix.
    const target = { latitude: latitudeRef, longitude: longitudeRef, outline: outlineRef }[first.field];
    target.current?.focus();
  };

  /** A whole pair pasted into either field fills both. */
  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pair = parseCoordinatePair(event.clipboardData.getData("text"));
    if (!pair) return;
    event.preventDefault();
    onAction({ type: "point-set", point: pair });
  };

  /** A pair typed by hand into one field is split when the person leaves the field. */
  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    const pair = parseCoordinatePair(event.target.value);
    if (pair) onAction({ type: "point-set", point: pair });
  };

  const modeOptions: readonly ChoiceOption<AreaKind>[] = AREA_MODES.map((mode) => ({
    value: mode,
    label: form.area.modes[mode],
  }));
  const sizeOptions: readonly ChoiceOption<BufferSide>[] = ANALYSIS_LIMITS.bufferSidesMeters.map((side) => ({
    value: side,
    label: fill(form.area.sizeOption, { side }),
  }));
  const yearOptions: readonly ChoiceOption<HistoryYears>[] = ANALYSIS_LIMITS.yearsOptions.map((years) => ({
    value: years,
    label: fill(form.history.option, { years }),
  }));

  const squareHectares = draft.sideMeters ** 2 / SQUARE_METERS_PER_HECTARE;
  const sizeSummary = fill(form.area.sizeSummary, {
    area: formatNumber(squareHectares, locale, Number.isInteger(squareHectares) ? 0 : 2) ?? "",
  });
  const isSquare = draft.mode === "buffer";

  return (
    <div className="flex flex-col gap-4">
      <PlaceSearch dict={dict.search} locale={locale} onPlaceChosen={onPlaceChosen} />

      <form aria-label={form.ariaLabel} noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <fieldset className="min-w-0">
          <legend className="sr-only">{form.location.legend}</legend>
          <div className="flex items-center gap-1.5">
            <span aria-hidden="true" className={SUB_LEGEND_CLASSES}>
              {form.location.legend}
            </span>
            <HelpButton label={helpLabel(form.location.legend)} state={coordinateHelp} />
          </div>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <CoordinateField
              id={`${baseId}-latitude`}
              label={form.location.latitude}
              placeholder={form.location.latitudePlaceholder}
              describedBy={coordinateHintId}
              value={draft.latitudeText}
              error={coordinateError(issues, "latitude", form)}
              inputRef={latitudeRef}
              onChange={(text) => onAction({ type: "latitude-typed", text })}
              onBlur={handleBlur}
              onPaste={handlePaste}
            />
            <CoordinateField
              id={`${baseId}-longitude`}
              label={form.location.longitude}
              placeholder={form.location.longitudePlaceholder}
              describedBy={coordinateHintId}
              value={draft.longitudeText}
              error={coordinateError(issues, "longitude", form)}
              inputRef={longitudeRef}
              onChange={(text) => onAction({ type: "longitude-typed", text })}
              onBlur={handleBlur}
              onPaste={handlePaste}
            />
          </div>
          <p id={coordinateHintId} className={`mt-1 ${HINT_CLASSES}`}>
            {isSquare ? form.location.hint : form.location.outlineModeNote}
          </p>
          <HelpText state={coordinateHelp} text={form.location.help} className="mt-1" />
        </fieldset>

        <ChoiceRow
          name={`${baseId}-mode`}
          legend={form.area.legend}
          help={{ label: helpLabel(form.area.legend), text: form.area.help }}
          options={modeOptions}
          value={draft.mode}
          onChange={(mode) => onAction({ type: "mode-chosen", mode })}
        >
          <p className={`mt-1 ${HINT_CLASSES}`}>{isSquare ? form.area.pointNote : form.outline.instructions}</p>

          {isSquare ? (
            <ChoiceRow
              name={`${baseId}-side`}
              legend={form.area.sizeLegend}
              note={sizeSummary}
              options={sizeOptions}
              value={draft.sideMeters}
              onChange={(sideMeters) => onAction({ type: "side-chosen", sideMeters })}
              className="mt-2"
            />
          ) : (
            <OutlineTools
              ref={outlineRef}
              dict={form.outline}
              locale={locale}
              draft={draft}
              error={outlineError(issues, form, locale)}
              onAction={onAction}
            />
          )}
        </ChoiceRow>

        <ChoiceRow
          name={`${baseId}-years`}
          legend={form.history.legend}
          help={{ label: helpLabel(form.history.legend), text: form.history.help }}
          options={yearOptions}
          value={draft.years}
          onChange={(years) => onAction({ type: "years-chosen", years })}
        />

        {/* Below lg it sticks to the bottom of the screen; the paper band keeps fields readable. */}
        <div className="sticky bottom-0 z-10 -mx-gutter border-t border-line bg-paper px-gutter py-3 lg:static lg:mx-0 lg:border-0 lg:p-0">
          <PixelButton type="submit" variant="accent" withArrow busy={busy} className="w-full">
            {busy ? form.submitting : form.submit}
          </PixelButton>
        </div>
      </form>
    </div>
  );
}
