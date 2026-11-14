"use client";

// Contract: AdvicePanel
// Props: request (AnalysisRequest, required) — the same request the analysis was run with
//        locale (Locale, required)
//        sourceNames (Record<SourceId, string>, required) — how each source is called on screen
// Variants: none
// States: hidden (the server has no language-model key: renders nothing) | idle (a line of
//         explanation and the "request recommendations" button) | loading (a small animation
//         and a status line while the model writes) | done (an ordered list of
//         recommendations, each with its reason and sources, then the chat) | error (plain
//         message by cause, with retry)
// Accessibility: a section with an h2; an ordered list with an h3 per recommendation; changes
//                are announced through a polite live region; the "AI-generated" origin is
//                always written out
// Responsive: a single column from 320 px up; text keeps a ~70 character measure

import { useEffect, useRef, useState } from "react";
import type { AnalysisRequest, SourceId } from "@/lib/analysis/types";
import type { Advice } from "@/lib/explain/advice";
import { AI_DICTIONARY } from "@/lib/i18n/app/ai";
import type { Locale } from "@/lib/site";
import { PixelButton } from "../pixel-button";
import { AdviceChat } from "./advice-chat";
import { AiPanel } from "./ai-panel";
import { isAiAvailable, postAi, type AiErrorKind } from "./ai-request";
import { AiThinking } from "./ai-thinking";

export interface AdvicePanelProps {
  readonly request: AnalysisRequest;
  readonly locale: Locale;
  readonly sourceNames: Readonly<Record<SourceId, string>>;
}

type Phase =
  | { readonly kind: "hidden" }
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "done"; readonly advice: Advice }
  | { readonly kind: "error"; readonly error: AiErrorKind };

const ENDPOINT = "/api/recommend";

export function AdvicePanel({ request, locale, sourceNames }: AdvicePanelProps) {
  const dict = AI_DICTIONARY[locale];
  const [phase, setPhase] = useState<Phase>({ kind: "hidden" });
  const pending = useRef<AbortController | null>(null);

  // Ask once whether the server can write recommendations; if it cannot, show nothing at all.
  useEffect(() => {
    const controller = new AbortController();
    isAiAvailable(controller.signal).then((available) => {
      if (available && !controller.signal.aborted) setPhase({ kind: "idle" });
    });
    return () => controller.abort();
  }, []);

  // Leaving the screen cancels recommendations that are still being written.
  useEffect(() => () => pending.current?.abort(), []);

  if (phase.kind === "hidden") return null;

  const ask = async () => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setPhase({ kind: "loading" });
    try {
      const result = await postAi<Advice>(ENDPOINT, { request, locale }, controller.signal);
      if (controller.signal.aborted) return;
      setPhase(result.ok ? { kind: "done", advice: result.data } : { kind: "error", error: result.error });
    } catch {
      // Cancelled because the screen was left: nothing to show.
    }
  };

  return (
    <AiPanel titleId="advice-title" title={dict.advice.title} origin={dict.origin}>
      <div aria-live="polite" className="flex flex-col gap-5">
        {phase.kind === "idle" ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-prose text-body">{dict.advice.intro}</p>
            <PixelButton variant="accent" withArrow onClick={() => void ask()}>
              {dict.advice.request}
            </PixelButton>
          </div>
        ) : null}

        {phase.kind === "loading" ? <AiThinking label={dict.advice.working} /> : null}

        {phase.kind === "error" ? (
          <>
            <p className="border-l-2 border-cinnabar pl-4 text-body">{dict.errors[phase.error]}</p>
            <div>
              <PixelButton variant="outline" onClick={() => void ask()}>
                {dict.retry}
              </PixelButton>
            </div>
          </>
        ) : null}

        {phase.kind === "done" ? (
          <>
            <ol className="flex flex-col">
              {phase.advice.recommendations.map((item, index) => (
                <li
                  key={item.title}
                  className="grid grid-cols-[auto_1fr] gap-x-4 border-b border-line py-4 first:pt-0"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-7 items-center justify-center bg-cinnabar font-mono text-small font-semibold text-ink"
                  >
                    {index + 1}
                  </span>
                  <div className="flex max-w-prose flex-col gap-2">
                    <h3 className="text-body font-semibold">{item.title}</h3>
                    <p className="text-body">{item.action}</p>
                    <p className="text-small text-muted">
                      <span className="font-semibold text-ink">{dict.advice.why}: </span>
                      {item.why}
                    </p>
                    <p className="font-mono text-label tracking-label text-muted uppercase">
                      {dict.basedOn}: {item.basedOn.map((source) => sourceNames[source]).join(" · ")}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="text-small text-muted">{dict.advice.basis}</p>
          </>
        ) : null}
      </div>

      {phase.kind === "done" ? (
        <AdviceChat request={request} locale={locale} sourceNames={sourceNames} />
      ) : null}
    </AiPanel>
  );
}
