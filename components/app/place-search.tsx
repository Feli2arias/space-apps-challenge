"use client";

// Contract: PlaceSearch
// Props: dict (WorkspaceDictionary["search"], required) — translated labels
//        locale (Locale, required) — language asked of the search service
//        onPlaceChosen ((place: Place) => void, required) — called when a result is picked;
//          the caller moves the map there. A place is never used as the plot's point.
// Variants: none
// States: idle | too short (message under the field) | searching (button busy, status
//         announced) | found (list of results to pick from, with the data credit) | found
//         nothing (plain message) | failed (plain message; searching again retries) |
//         chosen (the list closes and a line says where the map is now)
// Accessibility: a <form role="search"> with a short visible label ("Lugar") and an example
//                as placeholder; it searches on submit only, never while typing. Results are a list of buttons, each at
//                least 44px tall; the outcome is announced through a polite live region
//                and errors through role="alert". The credit the data provider requires
//                is shown as small text whenever results are on screen.
// Responsive: the field and the button share one row at every width; results stack

import { useId, useState, type FormEvent } from "react";
import type { Place, PlaceSearchFailure } from "@/lib/analysis/geocode-client";
import { MAX_PLACE_QUERY_LENGTH } from "@/lib/analysis/geocode-client";
import { fill } from "@/lib/i18n/app/results";
import type { WorkspaceDictionary } from "@/lib/i18n/app/workspace";
import type { Locale } from "@/lib/site";
import { PixelButton } from "./pixel-button";
import { usePlaceSearch } from "./use-place-search";

type SearchWords = WorkspaceDictionary["search"];

interface PlaceSearchProps {
  readonly dict: SearchWords;
  readonly locale: Locale;
  readonly onPlaceChosen: (place: Place) => void;
}

function failureText(failure: PlaceSearchFailure, dict: SearchWords): string {
  if (failure.kind === "network") return dict.errors.network;
  if (failure.kind === "rejected" && failure.status === 429) {
    return failure.retryAfterSeconds === null
      ? dict.errors.rateLimited
      : fill(dict.errors.rateLimitedWait, { seconds: failure.retryAfterSeconds });
  }
  return dict.errors.unavailable;
}

const NOTE_CLASSES = "mt-2 text-small text-muted";
const ERROR_CLASSES = "mt-2 text-small font-medium text-cinnabar-deep";

export function PlaceSearch({ dict, locale, onPlaceChosen }: PlaceSearchProps) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Place | null>(null);
  const { state, search } = usePlaceSearch(locale);
  const inputId = useId();
  const messageId = useId();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChosen(null);
    search(query);
  };

  const handleChoose = (place: Place) => {
    setChosen(place);
    onPlaceChosen(place);
  };

  const hasProblem = state.status === "too-short" || state.status === "failed";
  const places = state.status === "found" && !chosen ? state.places : [];

  return (
    <form role="search" onSubmit={handleSubmit} noValidate>
      <label htmlFor={inputId} className="block font-mono text-label tracking-label uppercase">
        {dict.label}
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={MAX_PLACE_QUERY_LENGTH}
          autoComplete="off"
          enterKeyHint="search"
          placeholder={dict.placeholder}
          aria-describedby={hasProblem ? messageId : undefined}
          aria-invalid={state.status === "too-short" || undefined}
          className="h-11 min-w-0 flex-1 border border-ink bg-white px-3 text-body placeholder:text-muted"
        />
        <PixelButton type="submit" size="sm" busy={state.status === "searching"}>
          {state.status === "searching" ? dict.searching : dict.submit}
        </PixelButton>
      </div>

      {state.status === "too-short" ? (
        <p id={messageId} role="alert" className={ERROR_CLASSES}>
          {dict.tooShort}
        </p>
      ) : null}
      {state.status === "failed" ? (
        <p id={messageId} role="alert" className={ERROR_CLASSES}>
          {failureText(state.failure, dict)}
        </p>
      ) : null}

      <p role="status" className={state.status === "found" ? NOTE_CLASSES : "sr-only"}>
        {state.status === "searching" ? dict.searching : null}
        {state.status === "found" && chosen ? fill(dict.moved, { place: chosen.displayName }) : null}
        {state.status === "found" && !chosen && state.places.length === 0 ? dict.none : null}
        {places.length > 0 ? fill(dict.found, { count: places.length }) : null}
      </p>

      {places.length > 0 ? (
        <ul aria-label={dict.resultsLabel} className="mt-2 border border-ink bg-white">
          {places.map((place) => (
            <li key={`${place.lat},${place.lon},${place.displayName}`} className="border-b border-line last:border-b-0">
              <button
                type="button"
                onClick={() => handleChoose(place)}
                className="flex min-h-11 w-full cursor-pointer flex-col items-start justify-center px-3 py-2 text-left transition-colors hover:bg-ink hover:text-white"
              >
                <span className="text-body font-semibold">{place.name}</span>
                <span className="text-small opacity-80">{place.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {state.status === "found" ? (
        <p className="mt-1 font-mono text-label text-muted">
          {dict.dataCredit} {state.attribution}
        </p>
      ) : null}
    </form>
  );
}
