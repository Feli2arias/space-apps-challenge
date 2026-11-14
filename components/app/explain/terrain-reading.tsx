"use client";

// Contract: TerrainReading
// Props: request (AnalysisRequest, required) — the same request the analysis was run with
//        locale (Locale, required)
//        sourceNames (Record<SourceId, string>, required) — how each source is called on screen
// Variants: none
// States: hidden (the server has no language-model key: renders nothing) | loading (starts by
//         itself when the results are shown; a small animation and a status line) | done (a
//         summary, then three groups of short points: in favour, possible problems, worth
//         checking; a group the data gave nothing for says so; on narrow screens each group
//         shows its titles first and a button opens the explanations) | error (plain message by
//         cause, with retry)
// Accessibility: a section with an h2; each group is an h3 with a list; the result is
//                announced through a polite live region; the "AI-generated" origin is written
//                out; the mark of each group is decorative, its name carries the meaning
// Responsive: one column on phones, the three groups side by side from the @3xl container width

import { useEffect, useState } from "react";
import { PixelIcon } from "@/components/ui/pixel-icon";
import type { PixelIconName } from "@/components/ui/pixel-icons";
import type { AnalysisRequest, SourceId } from "@/lib/analysis/types";
import { READING_GROUPS, type Reading, type ReadingGroup } from "@/lib/explain/reading";
import { AI_DICTIONARY } from "@/lib/i18n/app/ai";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/site";
import { PixelButton } from "../pixel-button";
import { AiPanel } from "./ai-panel";
import { isAiAvailable, postAi, type AiErrorKind } from "./ai-request";
import { AiThinking } from "./ai-thinking";

export interface TerrainReadingProps {
  readonly request: AnalysisRequest;
  readonly locale: Locale;
  readonly sourceNames: Readonly<Record<SourceId, string>>;
}

interface ReadingData extends Reading {
  readonly factCount: number;
}

type Phase =
  | { readonly kind: "hidden" }
  | { readonly kind: "loading" }
  | { readonly kind: "done"; readonly data: ReadingData }
  | { readonly kind: "error"; readonly error: AiErrorKind };

const ENDPOINT = "/api/reading";

const GROUP_STYLE: Readonly<Record<ReadingGroup, { readonly icon: PixelIconName; readonly mark: string }>> = {
  favorable: { icon: "check", mark: "bg-ink text-white" },
  alerts: { icon: "cross", mark: "bg-cinnabar text-ink" },
  toCheck: { icon: "observed", mark: "border border-ink bg-white text-ink" },
};

export function TerrainReading({ request, locale, sourceNames }: TerrainReadingProps) {
  const dict = AI_DICTIONARY[locale];
  const [phase, setPhase] = useState<Phase>({ kind: "hidden" });
  /** Grows with each press of "try again"; the first run also asks whether the feature exists. */
  const [attempt, setAttempt] = useState(0);
  /** Groups whose explanations are open on narrow screens, where only the titles show at first. */
  const [open, setOpen] = useState<readonly ReadingGroup[]>([]);
  const payload = JSON.stringify({ request, locale });
  const toggle = (group: ReadingGroup) =>
    setOpen((current) => (current.includes(group) ? current.filter((item) => item !== group) : [...current, group]));

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const load = async () => {
      if (attempt === 0 && !(await isAiAvailable(signal))) return;
      if (signal.aborted) return;
      setPhase({ kind: "loading" });
      const result = await postAi<ReadingData>(ENDPOINT, JSON.parse(payload), signal);
      if (signal.aborted) return;
      setPhase(result.ok ? { kind: "done", data: result.data } : { kind: "error", error: result.error });
    };

    // Leaving the screen cancels the request; that is not a failure to show.
    load().catch(() => undefined);
    return () => controller.abort();
  }, [attempt, payload]);

  if (phase.kind === "hidden") return null;

  return (
    <AiPanel titleId="terrain-reading-title" title={dict.reading.title} origin={dict.origin}>
      <div aria-live="polite" className="@container flex flex-col gap-5">
        {phase.kind === "loading" ? <AiThinking label={dict.reading.working} /> : null}

        {phase.kind === "error" ? (
          <>
            <p className="border-l-2 border-cinnabar pl-4 text-body">{dict.errors[phase.error]}</p>
            <div>
              <PixelButton variant="outline" onClick={() => setAttempt((count) => count + 1)}>
                {dict.retry}
              </PixelButton>
            </div>
          </>
        ) : null}

        {phase.kind === "done" ? (
          <>
            <p className="max-w-[75ch] text-lead">{phase.data.summary}</p>

            <div className="grid gap-x-8 gap-y-6 @3xl:grid-cols-3">
              {READING_GROUPS.map((group) => {
                const points = phase.data[group];
                const style = GROUP_STYLE[group];
                const expanded = open.includes(group);
                return (
                  <div key={group} className="flex flex-col gap-3">
                    <h3 className="flex items-center gap-2.5 font-mono text-label font-semibold tracking-label uppercase">
                      <span aria-hidden="true" className={cn("flex size-6 items-center justify-center", style.mark)}>
                        <PixelIcon name={style.icon} className="size-3" />
                      </span>
                      {dict.reading.groups[group]}
                    </h3>
                    {points.length === 0 ? (
                      <p className="text-small text-muted">{dict.reading.emptyGroup}</p>
                    ) : (
                      <ul className="flex flex-col gap-3">
                        {points.map((point) => (
                          <li key={point.title} className="flex flex-col gap-1 border-t border-line pt-3">
                            <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-body font-semibold">
                              {point.title}
                              <span className="font-mono text-label font-normal tracking-label text-muted uppercase">
                                {point.basedOn.map((source) => sourceNames[source]).join(" · ")}
                              </span>
                            </p>
                            <p className={cn("text-small text-muted", expanded ? "block" : "hidden @3xl:block")}>
                              {point.text}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                    {points.length > 0 ? (
                      <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => toggle(group)}
                        className="min-h-11 cursor-pointer self-start font-mono text-label font-semibold tracking-label text-cinnabar-deep uppercase @3xl:hidden"
                      >
                        {expanded ? dict.reading.less : dict.reading.more}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <p className="border-t border-dashed border-line pt-3 text-small text-muted">
              {dict.reading.basis.replace("{count}", String(phase.data.factCount))}
            </p>
          </>
        ) : null}
      </div>
    </AiPanel>
  );
}
