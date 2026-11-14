import { describe, expect, it, vi } from "vitest";
import type { AnalysisEvent, AnalysisRequest, SourceId, SourceMessages, SourceResult } from "@/lib/analysis/types";
import { WORKSPACE_DICTIONARY } from "@/lib/i18n/app/workspace";
import { INITIAL_ANALYSIS_STATE, analysisReducer, type AnalysisAction, type AnalysisState } from "./analysis-state";
import { progressText, toLoaderView } from "./loader-view";

/**
 * The real catalogues belong to the data sources and change with them. A fixed
 * one is used here so these tests only describe how messages are chosen.
 */
vi.mock("@/lib/analysis/sources/messages", () => {
  const catalogue = (title: string, stages: Record<string, string>): SourceMessages => ({
    title,
    summary: "",
    scope: {},
    metrics: {},
    limitations: {},
    qualityNotes: {},
    conversions: {},
    stages,
    noData: "",
  });
  const both = (es: SourceMessages, en: SourceMessages) => ({ es, en });
  return {
    SOURCE_MESSAGES: {
      rain: both(
        catalogue("Lluvia", { downloading: "Consultando el historial de lluvia…" }),
        catalogue("Rainfall", { downloading: "Querying the rainfall history…" }),
      ),
      vegetation: both(
        catalogue("Vegetación", { scenes: "Leyendo las imágenes disponibles…" }),
        catalogue("Vegetation", { scenes: "Reading the available images…" }),
      ),
      terrain: both(catalogue("Relieve", {}), catalogue("Terrain", {})),
      soil: both(catalogue("Suelo", {}), catalogue("Soil", {})),
      climate: both(catalogue("Clima", {}), catalogue("Climate", {})),
    },
  };
});

const words = WORKSPACE_DICTIONARY.es.loader;

const REQUEST: AnalysisRequest = {
  area: { kind: "buffer", center: { lat: 10.95, lon: -84.72 }, sideMeters: 200 },
  years: 5,
};

const accepted: AnalysisEvent = {
  type: "accepted",
  analysisId: "abc",
  area: {} as Extract<AnalysisEvent, { type: "accepted" }>["area"],
  period: { start: "2021-01-01", end: "2025-12-31" },
  sources: ["rain", "vegetation", "terrain"],
};

const finished = (source: SourceId, status: SourceResult["status"], fromCache = false): AnalysisEvent => ({
  type: "source-finished",
  source,
  result: { source, status, fromCache } as SourceResult,
});

function loading(...events: readonly AnalysisEvent[]): AnalysisState {
  const actions: AnalysisAction[] = [
    { type: "started", request: REQUEST },
    ...events.map((event) => ({ type: "event", event }) as const),
  ];
  return actions.reduce(analysisReducer, INITIAL_ANALYSIS_STATE);
}

const messageOf = (state: AnalysisState, locale: "es" | "en" = "es") =>
  toLoaderView(state, locale, WORKSPACE_DICTIONARY[locale].loader).message;

describe("the loading message", () => {
  it("is general before the backend reports anything", () => {
    expect(messageOf(loading())).toBe("Buscando datos para tu terreno…");
    expect(messageOf(loading(accepted))).toBe("Buscando datos para tu terreno…");
  });

  it("stays general while sources have started but none has reported a step", () => {
    const state = loading(accepted, { type: "source-started", source: "rain", fromCache: false });
    expect(messageOf(state)).toBe("Buscando datos para tu terreno…");
  });

  it("is the step the backend last reported, in the source's words", () => {
    const state = loading(accepted, {
      type: "source-progress",
      source: "rain",
      progress: { stage: "downloading" },
    });
    expect(messageOf(state)).toBe("Consultando el historial de lluvia…");
    expect(messageOf(state, "en")).toBe("Querying the rainfall history…");
  });

  it("adds the count when the source reports one", () => {
    const state = loading(accepted, {
      type: "source-progress",
      source: "vegetation",
      progress: { stage: "scenes", completed: 12, total: 40 },
    });
    expect(messageOf(state)).toBe("Leyendo las imágenes disponibles… (12 de 40)");
    expect(messageOf(state, "en")).toBe("Reading the available images… (12 of 40)");
  });

  it("shows a count of zero, which is a real zero", () => {
    const state = loading(accepted, {
      type: "source-progress",
      source: "vegetation",
      progress: { stage: "scenes", completed: 0, total: 40 },
    });
    expect(messageOf(state)).toBe("Leyendo las imágenes disponibles… (0 de 40)");
  });

  it("adds no count when only half of it is known", () => {
    const state = loading(accepted, {
      type: "source-progress",
      source: "vegetation",
      progress: { stage: "scenes", completed: 3 },
    });
    expect(messageOf(state)).toBe("Leyendo las imágenes disponibles…");
  });

  it("names the source when the step has no words of its own", () => {
    const state = loading(accepted, {
      type: "source-progress",
      source: "terrain",
      progress: { stage: "a-stage-nobody-wrote" },
    });
    expect(messageOf(state)).toBe("Consultando: Relieve…");
  });

  it("goes back to the previous running source when the latest one finishes", () => {
    const state = loading(
      accepted,
      { type: "source-progress", source: "rain", progress: { stage: "downloading" } },
      { type: "source-progress", source: "vegetation", progress: { stage: "scenes", completed: 1, total: 2 } },
      finished("vegetation", "ok"),
    );
    expect(messageOf(state)).toBe("Consultando el historial de lluvia…");
  });

  it("is general again when no running source has reported a step", () => {
    const state = loading(
      accepted,
      { type: "source-progress", source: "rain", progress: { stage: "downloading" } },
      finished("rain", "ok"),
    );
    expect(messageOf(state)).toBe("Buscando datos para tu terreno…");
  });

  it("says the results are being prepared once every source has finished", () => {
    const state = loading(
      accepted,
      finished("rain", "ok"),
      finished("vegetation", "no-data"),
      finished("terrain", "error"),
    );
    expect(messageOf(state)).toBe("Preparando los resultados…");
  });

  it("never contains a percentage", () => {
    const state = loading(accepted, {
      type: "source-progress",
      source: "vegetation",
      progress: { stage: "scenes", completed: 12, total: 40 },
    });
    expect(JSON.stringify(toLoaderView(state, "es", words))).not.toContain("%");
  });
});

describe("the list of sources", () => {
  it("names every source and starts them waiting", () => {
    const view = toLoaderView(loading(accepted), "es", words);
    expect(view.sources).toEqual([
      { id: "rain", label: "Lluvia", state: "waiting" },
      { id: "vegetation", label: "Vegetación", state: "waiting" },
      { id: "terrain", label: "Relieve", state: "waiting" },
    ]);
  });

  it("shows each source's own state and detail", () => {
    const view = toLoaderView(
      loading(
        accepted,
        { type: "source-progress", source: "vegetation", progress: { stage: "scenes", completed: 2, total: 9 } },
        finished("rain", "ok", true),
        finished("terrain", "error"),
      ),
      "es",
      words,
    );
    expect(view.sources).toEqual([
      { id: "rain", label: "Lluvia", state: "done", detail: "Resultado guardado" },
      { id: "vegetation", label: "Vegetación", state: "running", detail: "Leyendo las imágenes disponibles… (2 de 9)" },
      { id: "terrain", label: "Relieve", state: "failed" },
    ]);
  });
});

describe("progressText", () => {
  it("uses the language asked for", () => {
    const progress = { stage: "downloading", completed: 1, total: 5 };
    expect(progressText("rain", progress, "en", WORKSPACE_DICTIONARY.en.loader)).toBe(
      "Querying the rainfall history… (1 of 5)",
    );
  });
});
