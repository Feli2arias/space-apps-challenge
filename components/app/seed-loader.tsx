// Contract: SeedLoader
// Props: message (string, required) — what the backend has confirmed it is doing, already
//          translated
//        sources (readonly LoaderSource[], required) — each source's label, real state
//          (waiting | running | done | failed) and optional progress detail
// Variants: none
// States: loading only. A tiny plant grows from seed to flower and starts again, for as long
//         as the component is mounted; there is no "finished" frame, no percentage and nothing
//         that fills up: the caller unmounts it when results or an error arrive.
//         Empty `sources` renders the drawing and the message alone.
//         Reduced motion: the grown flower, still, with the same text.
// Accessibility: the message is a polite live region (role="status"); the source list is a
//                labelled list outside it, so row changes are not read out one by one; each
//                state is written as a word; the drawing is decorative
// Responsive: a centred column that fills its container, from 320px up
"use client";

import type { SourceId } from "@/lib/analysis/types";
import { getResultsDictionary } from "@/lib/i18n/app/results";
import { MiniSprout } from "./loader/mini-sprout";
import { SourceStatusList } from "./loader/source-status-list";
import { useDocumentLocale } from "./loader/use-document-locale";

export type LoaderSourceState = "waiting" | "running" | "done" | "failed";

export interface LoaderSource {
  readonly id: SourceId;
  readonly label: string;
  readonly state: LoaderSourceState;
  /** Real progress text for this source, e.g. "Escena 12 de 40". */
  readonly detail?: string;
}

export interface SeedLoaderProps {
  /** The message for what the backend has confirmed it is doing right now. */
  readonly message: string;
  readonly sources: readonly LoaderSource[];
}

export function SeedLoader({ message, sources }: SeedLoaderProps) {
  // The props carry translated text but no language, and the four state words
  // ("waiting", "done"…) still have to be written: they follow the page's language.
  const locale = useDocumentLocale();
  const { loader } = getResultsDictionary(locale);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 px-4 py-2 text-center sm:gap-6 sm:py-8">
      <MiniSprout className="mt-2" />
      <p role="status" aria-live="polite" className="font-display text-h3 text-balance uppercase">
        {message}
      </p>
      <SourceStatusList sources={sources} stateLabels={loader.states} label={loader.sourcesLabel} />
    </div>
  );
}
