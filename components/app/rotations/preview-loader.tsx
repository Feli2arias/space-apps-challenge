"use client";

// Contract: RotationsPreviewLoader (development only)
// Props: none — the language comes from `?lang=en` in the address (default Spanish)
// Variants: none
// States: loading (a sentence) | error (the reason in words) | ready (RotationExplorer with a
//         real analysis of the test area, fetched from POST /api/analysis)
// Accessibility: status sentences use role="status"; the explorer brings its own headings
// Responsive: the explorer sits in a column capped at 30rem, like the results panel

import { useEffect, useState } from "react";
import type { Analysis, AnalysisEvent } from "@/lib/analysis/types";
import type { Locale } from "@/lib/site";
import { RotationExplorer } from "./rotation-explorer";

/** The shared test area: a 200 m square in Los Chiles, Costa Rica, three years. */
const TEST_REQUEST = {
  area: { kind: "buffer", center: { lat: 10.95, lon: -84.72 }, sideMeters: 200 },
  years: 3,
} as const;

type LoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "ready"; readonly analysis: Analysis; readonly locale: Locale };

async function loadAnalysis(signal: AbortSignal): Promise<Analysis> {
  const response = await fetch("/api/analysis", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(TEST_REQUEST),
    signal,
  });
  const lines = (await response.text()).split("\n").filter((line) => line.trim() !== "");
  const events = lines.map((line) => JSON.parse(line) as AnalysisEvent);
  const done = events.find((event) => event.type === "done");
  if (done?.type === "done") return done.analysis;
  const fatal = events.find((event) => event.type === "fatal");
  throw new Error(fatal?.type === "fatal" ? fatal.error.message : `HTTP ${response.status}`);
}

export function RotationsPreviewLoader() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    const locale: Locale = new URLSearchParams(window.location.search).get("lang") === "en" ? "en" : "es";
    loadAnalysis(controller.signal)
      .then((analysis) => setState({ kind: "ready", analysis, locale }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ kind: "error", message: error instanceof Error ? error.message : String(error) });
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="min-h-dvh bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-[30rem]">
        {state.kind === "ready" ? (
          <RotationExplorer analysis={state.analysis} locale={state.locale} />
        ) : (
          <p role="status" className="text-body">
            {state.kind === "loading" ? "Loading the test-area analysis…" : `Could not load: ${state.message}`}
          </p>
        )}
      </div>
    </main>
  );
}
