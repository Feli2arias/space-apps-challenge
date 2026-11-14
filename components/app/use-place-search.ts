"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isSearchableQuery,
  searchPlaces,
  type Place,
  type PlaceSearchFailure,
} from "@/lib/analysis/geocode-client";
import type { Locale } from "@/lib/site";

/**
 * Searches places by name, one search at a time.
 *
 * A search runs only when the person asks for it (never on each keystroke):
 * the service behind it, OpenStreetMap's Nominatim, does not allow
 * search-as-you-type. A new search aborts the previous one, and an answer
 * that arrives late for an older search is dropped.
 */

export type PlaceSearchState =
  | { readonly status: "idle" }
  | { readonly status: "too-short" }
  | { readonly status: "searching" }
  | { readonly status: "found"; readonly places: readonly Place[]; readonly attribution: string }
  | { readonly status: "failed"; readonly failure: PlaceSearchFailure };

export interface UsePlaceSearch {
  readonly state: PlaceSearchState;
  readonly search: (query: string) => void;
  /** Stops any search in flight and forgets the results. */
  readonly clear: () => void;
}

const IDLE: PlaceSearchState = { status: "idle" };

export function usePlaceSearch(locale: Locale): UsePlaceSearch {
  const [state, setState] = useState<PlaceSearchState>(IDLE);
  const run = useRef<{ counter: number; controller: AbortController | null }>({
    counter: 0,
    controller: null,
  });

  const supersede = useCallback((): number => {
    run.current.controller?.abort();
    run.current.controller = null;
    run.current.counter += 1;
    return run.current.counter;
  }, []);

  const search = useCallback(
    (query: string) => {
      const token = supersede();
      if (!isSearchableQuery(query)) {
        setState({ status: "too-short" });
        return;
      }
      const controller = new AbortController();
      run.current.controller = controller;
      setState({ status: "searching" });

      void searchPlaces(query, locale, { signal: controller.signal }).then((outcome) => {
        if (run.current.counter !== token || outcome.kind === "aborted") return;
        run.current.controller = null;
        setState(
          outcome.kind === "found"
            ? { status: "found", places: outcome.places, attribution: outcome.attribution }
            : { status: "failed", failure: outcome },
        );
      });
    },
    [locale, supersede],
  );

  const clear = useCallback(() => {
    supersede();
    setState(IDLE);
  }, [supersede]);

  useEffect(() => {
    const current = run.current;
    return () => {
      current.controller?.abort();
      current.counter += 1;
    };
  }, []);

  return { state, search, clear };
}
