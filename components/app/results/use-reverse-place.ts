"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/site";
import { parseReversePlace, reverseUrl, type ReversePlace } from "./place";

export type ReversePlaceState =
  | { readonly status: "loading" }
  | { readonly status: "done"; readonly place: ReversePlace }
  | { readonly status: "failed" };

interface Answer {
  readonly url: string;
  readonly state: ReversePlaceState;
}

/**
 * Asks the server which place a point is in. The request is aborted when the
 * point changes or the component goes away, and an answer for an older point
 * is ignored. A failure only means the name is not shown.
 */
export function useReversePlace(lat: unknown, lon: unknown, locale: Locale): ReversePlaceState {
  const url = reverseUrl(lat, lon, locale);
  const [answer, setAnswer] = useState<Answer | null>(null);

  useEffect(() => {
    if (url === null) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal, headers: { accept: "application/json" } })
      .then((response) => response.json() as Promise<unknown>)
      .then((body) => {
        const place = parseReversePlace(body);
        setAnswer({ url, state: place ? { status: "done", place } : { status: "failed" } });
      })
      .catch(() => {
        if (!controller.signal.aborted) setAnswer({ url, state: { status: "failed" } });
      });
    return () => controller.abort();
  }, [url]);

  if (url === null) return { status: "failed" };
  return answer?.url === url ? answer.state : { status: "loading" };
}
