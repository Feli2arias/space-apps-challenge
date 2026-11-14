"use client";

// Contract: MetricHighlight (a highlighted figure on a card) and MetricRow (a compact line in
//           "Otras cifras")
// Props: metric (Metric, required) — id, value (null = missing), unit, aggregation, moment
//        Highlight: label (string), explanation (string | null) — one plain line on what the
//          measure is; anchor (boolean) — the card's first figure, drawn larger
//        Row: text (ResolvedMetricText) — label and help from the source's catalogue (the id
//          when the catalogue lacks it); layout (ResultsLayoutDictionary) — the "?" name
//        dict (ResultsDictionary, required)
// Variants: highlight anchor (largest numeral, full width) | highlight (numeral) |
//           row (label and value on one line, with the aggregation word)
// States: value | zero (a numeral like any other) | missing (the words "sin dato", never a
//         0) | unknown metric (row: the id in mono type, no help) | row help open
// Accessibility: a list item read in order — label, value with unit, how it was aggregated,
//                when it belongs to; the help is a disclosure button (see HelpToggle)
// Responsive: fills its grid cell; value and unit wrap if the cell is narrow

import { formatMetricMoment, formatMetricValue } from "@/lib/analysis/format";
import type { Metric } from "@/lib/analysis/types";
import { fill, type ResultsDictionary } from "@/lib/i18n/app/results";
import type { ResultsLayoutDictionary } from "@/lib/i18n/app/results-layout";
import { cn } from "@/lib/cn";
import { HelpButton, HelpText, useHelpToggle } from "./help-toggle";
import type { ResolvedMetricText } from "./messages";

interface MetricRowProps {
  readonly metric: Metric;
  readonly text: ResolvedMetricText;
  readonly dict: ResultsDictionary;
  readonly layout: ResultsLayoutDictionary;
}

function aggregationOf(metric: Metric, dict: ResultsDictionary): string {
  return Object.hasOwn(dict.aggregation, metric.aggregation)
    ? dict.aggregation[metric.aggregation]
    : String(metric.aggregation);
}

/** "promedio · Corresponde a marzo 2024": the technical form, used in "Más detalles". */
function MetricNote({ metric, dict }: Pick<MetricRowProps, "metric" | "dict">) {
  const moment = formatMetricMoment(metric.at, dict.locale);
  return (
    <p className="font-mono text-label tracking-label text-muted uppercase">
      {aggregationOf(metric, dict)}
      {moment ? <> · {fill(dict.metrics.at, { moment })}</> : null}
    </p>
  );
}

interface MetricHighlightProps {
  readonly metric: Metric;
  readonly label: string;
  /** One plain line on what the measure is; `null` writes nothing. */
  readonly explanation: string | null;
  /** The first figure of a card is drawn larger: it is the card's anchor. */
  readonly anchor: boolean;
  readonly dict: ResultsDictionary;
}

/** "Mes más lluvioso · julio": the moment joins the label instead of a separate line. */
function labelWithMoment(label: string, metric: Metric, dict: ResultsDictionary): string {
  const moment = formatMetricMoment(metric.at, dict.locale);
  return moment ? `${label} · ${moment}` : label;
}

export function MetricHighlight({ metric, label, explanation, anchor, dict }: MetricHighlightProps) {
  const formatted = formatMetricValue(metric, dict.locale);
  // "pH 5,3", not "pH 5,3 pH": a unit the label already says is not repeated.
  const words = label.toLowerCase().split(/\s+/);
  const unit = formatted?.unit && !words.includes(formatted.unit.toLowerCase()) ? formatted.unit : "";

  return (
    <li data-missing={formatted === null ? "true" : undefined} className={cn("flex min-w-0 flex-col gap-1", anchor && "col-span-full")}>
      <p className="text-small font-medium">{labelWithMoment(label, metric, dict)}</p>
      {formatted === null ? (
        <p className="font-display text-title text-muted uppercase">{dict.missing}</p>
      ) : (
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          <span className={cn("font-display tabular-nums", anchor ? "text-stat" : "text-numeral")}>{formatted.text}</span>
          {unit ? <span className="font-mono text-small text-muted">{unit}</span> : null}
        </p>
      )}
      {explanation ? <p className="text-small text-muted">{explanation}</p> : null}
    </li>
  );
}

export function MetricRow({ metric, text, dict, layout }: MetricRowProps) {
  const formatted = formatMetricValue(metric, dict.locale);
  const help = useHelpToggle();

  return (
    <li data-missing={formatted === null ? "true" : undefined} className="border-b border-line py-2.5 last:border-b-0">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className={cn("text-small", !text.known && "font-mono break-all")}>{text.label}</p>
          <MetricNote metric={metric} dict={dict} />
        </div>
        <p className="shrink-0 text-right font-mono text-small font-semibold tabular-nums">
          {formatted === null ? (
            <span className="font-normal text-muted uppercase">{dict.missing}</span>
          ) : (
            <>
              {formatted.text}
              {formatted.unit ? <span className="ml-1 font-normal text-muted">{formatted.unit}</span> : null}
            </>
          )}
        </p>
        {text.help ? (
          <HelpButton label={fill(layout.help.metric, { label: text.label })} state={help} />
        ) : null}
      </div>
      {text.help ? <HelpText state={help} text={text.help} className="mt-1.5" /> : null}
    </li>
  );
}
