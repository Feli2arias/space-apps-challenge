"use client";

// Contract: RotationExplorer
// Props: analysis (Analysis, required) — the plot's analysis; monthly rainfall and vegetation
//          scenes are read from it
//        locale (Locale, required)
// Variants: none
// States: loading (first comparison on its way: readings say "calculating") | ready |
//         updating (an edit is being recalculated: old figures dimmed, "updating" announced) |
//         error (network or server: sentence, readings hidden until the next change works) |
//         rain incomplete (soil-exposure reading unavailable, previous-crop reading kept) |
//         rain or vegetation missing (the month strip says which and draws nothing)
// Accessibility: a section labelled by its h2; status changes are announced through a polite
//                live region; every figure carries its origin (declared, study, modelled,
//                calculated) in words
// Responsive: container queries — the three rotation cards sit side by side when the panel is
//             at least 60rem wide and stack below that (phone sheet from 320px)

import { useId, useMemo, useState } from "react";
import { PixelButton } from "@/components/app/pixel-button";
import type { Analysis } from "@/lib/analysis/types";
import { getRotationsDictionary, type RotationsDictionary } from "@/lib/i18n/app/rotations";
import type { RotationReading } from "@/lib/rotation/compare";
import type { Locale } from "@/lib/site";
import { ComparisonSummary } from "./comparison-summary";
import {
  EXAMPLE_PLANS,
  buildRotationRequest,
  isExample,
  monthlyRainFrom,
  replacePlan,
  type EditablePlan,
} from "./plans";
import { RainCoverStrip } from "./rain-cover-strip";
import { RotationCard } from "./rotation-card";
import { useRotationComparison, type ComparisonState } from "./use-rotation-comparison";

export interface RotationExplorerProps {
  readonly analysis: Analysis;
  readonly locale: Locale;
}

/** Readings whose previous crop matches what the plan declares now; stale ones are dropped. */
function matchingReadings(
  plans: readonly EditablePlan[],
  state: ComparisonState,
): ReadonlyMap<string, RotationReading> {
  if (!state.result || state.failure) return new Map();
  const byId = new Map(state.result.readings.map((reading) => [reading.planId, reading]));
  return new Map(
    plans.flatMap((plan) => {
      const reading = byId.get(plan.id);
      return reading && reading.previousCrop === plan.previousCrop ? [[plan.id, reading] as const] : [];
    }),
  );
}

function statusText(state: ComparisonState, dict: RotationsDictionary): string {
  if (state.failure === "rate-limited") return dict.status.rateLimited;
  if (state.failure === "invalid") return dict.status.invalid;
  if (state.failure) return dict.status.error;
  return state.pending && state.result ? dict.status.updating : "";
}

export function RotationExplorer({ analysis, locale }: RotationExplorerProps) {
  const titleId = useId();
  const dict = getRotationsDictionary(locale);
  const [plans, setPlans] = useState<readonly EditablePlan[]>(EXAMPLE_PLANS);
  const monthlyRain = useMemo(() => monthlyRainFrom(analysis), [analysis]);
  const request = useMemo(() => buildRotationRequest(plans, monthlyRain), [plans, monthlyRain]);
  const state = useRotationComparison(request);
  const readings = matchingReadings(plans, state);
  const gap = !state.pending && state.result?.exposureGap === "rain-incomplete";
  const status = statusText(state, dict);
  const anyEdited = plans.some((plan) => !isExample(plan));

  return (
    <section aria-labelledby={titleId} className="@container flex flex-col gap-6 text-ink">
      <header className="flex flex-col gap-2">
        <h2 id={titleId} className="font-display text-title uppercase">
          {dict.title}
        </h2>
        <p className="text-body">{dict.intro}</p>
      </header>

      <RainCoverStrip analysis={analysis} dict={dict} />

      <div className="flex flex-col gap-3 border-l-2 border-cinnabar pl-4">
        <p className="text-body">{dict.exampleWarning}</p>
        {anyEdited ? (
          <PixelButton size="sm" className="self-start" onClick={() => setPlans(EXAMPLE_PLANS)}>
            {dict.resetExamples}
          </PixelButton>
        ) : null}
      </div>

      <ComparisonSummary plans={plans} readings={readings} gap={gap} pending={state.pending} dict={dict} />

      <p role="status" aria-live="polite" className={status ? "font-mono text-label tracking-label uppercase text-cinnabar-deep" : "sr-only"}>
        {status}
      </p>

      <div className="grid items-start gap-5 @min-[60rem]:grid-cols-3">
        {plans.map((plan) => (
          <RotationCard
            key={plan.id}
            plan={plan}
            reading={readings.get(plan.id) ?? null}
            study={state.result?.study ?? null}
            gap={gap}
            pending={state.pending}
            onChange={(next) => setPlans((current) => replacePlan(current, next))}
            dict={dict}
          />
        ))}
      </div>

      <p className="border-t-2 border-ink pt-4 text-body font-semibold">{dict.closing}</p>
    </section>
  );
}
