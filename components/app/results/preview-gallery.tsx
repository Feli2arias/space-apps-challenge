// Contract: PreviewGallery (development only — test scaffolding, not part of the product)
// Props: none. Reads its starting state from the address: ?view=loader|complete|partial|failed,
//        ?locale=es|en, ?text=sample|catalogue, ?frame=column|free
// Variants: view (the loader or one of three invented analyses) | text ("sample" uses stand-in
//           sentences, "catalogue" uses the real source catalogues) | frame ("column" puts
//           the panel in a fixed-height box, as in the app; "free" lets it grow)
// States: retry is simulated: the source shows as busy for a moment and nothing changes
// Accessibility: a banner states in words that all data shown is invented; controls are
//                plain buttons with aria-pressed
// Responsive: the framed column is at most 28rem wide and centred; controls wrap
"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SOURCE_MESSAGES } from "@/lib/analysis/sources/messages";
import type { SourceId } from "@/lib/analysis/types";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/site";
import { SeedLoader, type LoaderSource } from "../seed-loader";
import { SAMPLE_MESSAGES } from "./preview-messages";
import { PREVIEW_SAMPLES, type PreviewSampleName } from "./preview-samples";
import { ResultsPanelView } from "./results-panel-view";

type View = "loader" | PreviewSampleName;
type TextSource = "sample" | "catalogue";
type Frame = "column" | "free";

const VIEWS: readonly View[] = ["loader", "complete", "partial", "failed"];
const LOCALES: readonly Locale[] = ["es", "en"];
const TEXT_SOURCES: readonly TextSource[] = ["sample", "catalogue"];
const FRAMES: readonly Frame[] = ["column", "free"];

/** How long the simulated retry shows its busy state, in milliseconds. */
const SIMULATED_RETRY_MS = 2500;

/** Invented loader rows, one per state, so every row look can be checked at once. */
const SAMPLE_LOADER_SOURCES: readonly LoaderSource[] = [
  { id: "rain", label: "Sample: rain", state: "done" },
  { id: "vegetation", label: "Sample: vegetation", state: "running", detail: "Sample detail: step 12 of 40" },
  { id: "terrain", label: "Sample: terrain", state: "failed" },
  { id: "soil", label: "Sample: soil", state: "running" },
  { id: "climate", label: "Sample: climate", state: "waiting" },
];

function pick<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return options.find((option) => option === value) ?? fallback;
}

interface ChoiceProps<T extends string> {
  readonly label: string;
  readonly options: readonly T[];
  readonly value: T;
  readonly onChange: (value: T) => void;
}

function Choice<T extends string>({ label, options, value, onChange }: ChoiceProps<T>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-label tracking-label text-muted uppercase">{label}</span>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === value}
          onClick={() => onChange(option)}
          className={cn(
            "min-h-11 border border-ink px-3 font-mono text-label tracking-label uppercase",
            option === value ? "bg-ink text-white" : "bg-white text-ink",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function PreviewGallery() {
  const params = useSearchParams();
  const [view, setView] = useState<View>(pick(params.get("view"), VIEWS, "complete"));
  const [locale, setLocale] = useState<Locale>(pick(params.get("locale"), LOCALES, "es"));
  const [text, setText] = useState<TextSource>(pick(params.get("text"), TEXT_SOURCES, "sample"));
  const [frame, setFrame] = useState<Frame>(pick(params.get("frame"), FRAMES, "column"));
  const [retrying, setRetrying] = useState<readonly SourceId[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const simulateRetry = (source: SourceId) => {
    setRetrying((current) => (current.includes(source) ? current : [...current, source]));
    timers.current.push(
      setTimeout(
        () => setRetrying((current) => current.filter((id) => id !== source)),
        SIMULATED_RETRY_MS,
      ),
    );
  };

  return (
    <main className="min-h-dvh bg-mist">
      <p
        role="note"
        className="border-b border-ink bg-cinnabar px-4 py-3 text-center font-mono text-small font-semibold tracking-label text-ink uppercase"
      >
        Datos de muestra inventados · solo para probar el diseño · no son resultados reales
        <span className="block font-normal normal-case">
          Invented sample data for layout testing only. Nothing on this page was measured.
        </span>
      </p>

      <div className="flex flex-wrap gap-x-8 gap-y-3 border-b border-line bg-paper px-4 py-3">
        <Choice label="view" options={VIEWS} value={view} onChange={setView} />
        <Choice label="locale" options={LOCALES} value={locale} onChange={setLocale} />
        <Choice label="text" options={TEXT_SOURCES} value={text} onChange={setText} />
        <Choice label="frame" options={FRAMES} value={frame} onChange={setFrame} />
      </div>

      <div
        id="preview-frame"
        className={cn(
          "mx-auto w-full max-w-md border-x border-ink bg-paper",
          frame === "column" && "h-[calc(100dvh-12rem)] min-h-96",
        )}
      >
        {view === "loader" ? (
          <SeedLoader message="Sample message: querying the sources…" sources={SAMPLE_LOADER_SOURCES} />
        ) : (
          <ResultsPanelView
            analysis={PREVIEW_SAMPLES[view]}
            locale={locale}
            onRetry={simulateRetry}
            retrying={retrying}
            catalogue={text === "sample" ? SAMPLE_MESSAGES : SOURCE_MESSAGES}
          />
        )}
      </div>
    </main>
  );
}
