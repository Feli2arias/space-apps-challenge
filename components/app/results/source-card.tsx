"use client";

// Contract: SourceCard
// Props: result (SourceResult, required) — one source of the analysis
//        title (string, required) — topic name ("Lluvia")
//        icon (readonly string[], required) — pixel bitmap beside the title
//        messages (SourceMessages | null, required) — the source's catalogue for the locale
//        areaKind (AreaKind, required) — passed to the scope tag
//        sentences (readonly string[], required) — the plain report built from this result
//        note (ReactNode, optional) — a caveat shown while closed (temperature altitude)
//        detail (ReactNode, optional) — the month-by-month or class-by-class detail
//        retrying (boolean, required), onRetry (() => void, required)
//        dict, layout, report (dictionaries, required)
// Variants: none
// States: closed (header, sentences, 2–4 highlighted figures, "Ver más") | open (in place:
//           other figures, detail, when the data was obtained, "Fuentes y limitaciones"
//           already unfolded) — several cards can be open at once |
//         no-data (the source's "no data" sentence and what was examined) |
//         error (plain explanation and Retry; no button when not retryable) |
//         retrying (a "consultando" tag and a busy button)
// Accessibility: an article labelled by its h3; the scope tag says in words what the numbers
//                describe; "Ver más" is a button with aria-expanded and aria-controls; the
//                closed part is removed from the reading order (hidden), not just hidden
//                from view; missing values are written "sin dato"
// Responsive: placed in a subgrid by the dashboard so the header, sentences, figures and
//             button line up across a row; when open it spans the whole row

import { useId, useState, type ReactNode } from "react";
import { PixelIcon } from "@/components/ui/pixel-icon";
import { formatDateRange, formatInstantUtc, formatNumber } from "@/lib/analysis/format";
import type { AreaKind, SourceMessages, SourceResult } from "@/lib/analysis/types";
import type { ReportDictionary } from "@/lib/i18n/app/report";
import { fill, type ResultsDictionary } from "@/lib/i18n/app/results";
import type { ResultsLayoutDictionary } from "@/lib/i18n/app/results-layout";
import { cn } from "@/lib/cn";
import { BitmapIcon } from "./bitmap-icon";
import { CARD_FIGURES, splitMetrics } from "./layout-model";
import { MetricHighlight, MetricRow } from "./metric-card";
import { presentText, resolveMetric, textOr } from "./messages";
import { RetryButton } from "./retry-button";
import { ScopeTag } from "./scope-tag";
import { SourceDetails } from "./source-details";

interface SourceCardProps {
  readonly result: SourceResult<unknown>;
  readonly title: string;
  readonly icon: readonly string[];
  readonly messages: SourceMessages | null;
  readonly areaKind: AreaKind;
  readonly sentences: readonly string[];
  readonly note?: ReactNode;
  readonly detail?: ReactNode;
  readonly retrying: boolean;
  readonly onRetry: () => void;
  readonly dict: ResultsDictionary;
  readonly layout: ResultsLayoutDictionary;
  readonly report: ReportDictionary;
}

interface PartProps {
  readonly result: SourceResult<unknown>;
  readonly dict: ResultsDictionary;
}

/** Says whether the result was read from saved data, and when it was obtained. */
function Provenance({ result, dict }: PartProps) {
  const date = formatInstantUtc(result.retrievedAt, dict.locale);
  const { provenance } = dict;
  const label = result.fromCache
    ? date
      ? fill(provenance.cached, { date })
      : provenance.cachedUndated
    : date
      ? fill(provenance.fresh, { date })
      : provenance.freshUndated;
  return (
    <p className="flex items-start gap-2 font-mono text-label tracking-label text-muted uppercase">
      <PixelIcon name={result.fromCache ? "declared" : "observed"} className="mt-1 size-3" />
      {label}
    </p>
  );
}

/** What the source looked at when it answered with no valid observations. */
function ExaminedNote({ result, dict }: PartProps) {
  const { noData, locale } = dict;
  const period = formatDateRange(result.period, locale);
  const valid = formatNumber(result.quality?.valid, locale);
  const expected = formatNumber(result.quality?.expected, locale);
  const observations =
    valid === null
      ? noData.examinedUnknown
      : expected === null
        ? fill(noData.examinedValidOnly, { valid })
        : fill(noData.examinedObservations, { valid, expected });
  return (
    <p className="mt-2 text-small text-muted">
      <span className="font-mono text-label tracking-label uppercase">{noData.examined}: </span>
      {period ? `${fill(noData.examinedPeriod, { period })} ` : ""}
      {observations}
    </p>
  );
}

function errorSentence(result: SourceResult<unknown>, dict: ResultsDictionary): string {
  const code = result.error?.code;
  if (code && Object.hasOwn(dict.error.codes, code)) return dict.error.codes[code];
  return fill(dict.error.unknownCode, { code: String(code ?? "?") });
}

function statusLabelOf(result: SourceResult<unknown>, retrying: boolean, dict: ResultsDictionary): string | null {
  if (retrying) return dict.sourceStatus.retrying;
  if (result.status === "no-data") return dict.sourceStatus.noData;
  return result.status === "ok" ? null : dict.sourceStatus.error;
}

/** What the card says while closed, under its header. */
function Lead({ result, sentences, messages, title, retrying, onRetry, dict, report }: SourceCardProps) {
  if (result.status === "no-data") {
    return (
      <div>
        <p className="text-body">{textOr(messages?.noData, dict.noData.fallback)}</p>
        <ExaminedNote result={result} dict={dict} />
      </div>
    );
  }
  if (result.status !== "ok") {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-body">{errorSentence(result, dict)}</p>
        {result.error?.retryable === false ? (
          <p className="text-small text-muted">{dict.error.notRetryable}</p>
        ) : (
          <RetryButton sourceTitle={title} busy={retrying} onRetry={onRetry} dict={dict} />
        )}
      </div>
    );
  }
  if (sentences.length === 0) return <p className="text-body text-muted">{report.empty}</p>;
  return (
    <div className="flex flex-col gap-1.5 text-body">
      {sentences.map((sentence) => (
        <p key={sentence}>{sentence}</p>
      ))}
    </div>
  );
}

export function SourceCard(props: SourceCardProps) {
  const { result, title, icon, messages, areaKind, note, detail, retrying, dict, layout, report } = props;
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const moreId = useId();
  const isError = result.status !== "ok" && result.status !== "no-data";
  const { primary, rest } = isError
    ? { primary: [], rest: [] }
    : splitMetrics(result.metrics, CARD_FIGURES[result.source] ?? []);
  const statusLabel = statusLabelOf(result, retrying, dict);
  const labelOf = (id: string) =>
    Object.hasOwn(report.labels, id) ? report.labels[id] : resolveMetric(messages, id).label;

  return (
    <article
      aria-labelledby={titleId}
      data-source={result.source}
      data-status={result.status}
      className={cn("row-span-4 grid grid-rows-subgrid gap-y-5 bg-white p-5 @xl:p-6", open && "col-span-full")}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 id={titleId} className="flex items-center gap-2.5 font-display text-h3 font-normal uppercase">
          <BitmapIcon bitmap={icon} className="size-5" />
          {title}
        </h3>
        {isError ? null : <ScopeTag scope={result.scope} areaKind={areaKind} dict={dict} layout={layout} />}
        {statusLabel ? (
          <span
            className={cn(
              "px-2 py-0.5 font-mono text-label tracking-label uppercase",
              isError && !retrying ? "bg-ink text-white" : "border border-ink",
            )}
          >
            {statusLabel}
          </span>
        ) : null}
      </header>

      <div className="max-w-[70ch]">
        <Lead {...props} />
      </div>

      <div className="flex flex-col gap-4">
        {primary.length > 0 ? (
          <ul aria-label={dict.metrics.heading} className="grid grid-cols-2 gap-x-5 gap-y-5">
            {primary.map((metric, index) => (
              <MetricHighlight
                key={metric.id}
                metric={metric}
                label={labelOf(metric.id)}
                explanation={Object.hasOwn(report.explain, metric.id) ? report.explain[metric.id] : null}
                anchor={index === 0}
                dict={dict}
              />
            ))}
          </ul>
        ) : null}
        {note}
      </div>

      <div className="flex flex-col gap-6 self-end">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={moreId}
          onClick={() => setOpen((value) => !value)}
          className="group inline-flex min-h-11 cursor-pointer items-center gap-2 self-start font-mono text-label font-semibold tracking-label text-cinnabar-deep uppercase"
        >
          {open ? layout.dashboard.showLess : layout.dashboard.showMore}
          <span className="sr-only">: {title}</span>
          <PixelIcon name="arrow" className={cn("h-2.5 w-3", open ? "-rotate-90" : "rotate-90")} />
        </button>

        <div id={moreId} hidden={!open} className="flex flex-col gap-8 border-t border-line pt-6">
          {rest.length > 0 ? (
            <section>
              <h4 className="font-mono text-label tracking-label text-cinnabar-deep uppercase">{layout.dashboard.moreFigures}</h4>
              <ul className="mt-2 grid gap-x-8 @2xl:grid-cols-2">
                {rest.map((metric) => (
                  <MetricRow
                    key={metric.id}
                    metric={metric}
                    text={{ ...resolveMetric(messages, metric.id), label: labelOf(metric.id), known: true }}
                    dict={dict}
                    layout={layout}
                  />
                ))}
              </ul>
            </section>
          ) : null}
          {detail}
          {isError ? null : <Provenance result={result} dict={dict} />}
          <SourceDetails result={result} messages={messages} intro={presentText(messages?.summary)} dict={dict} defaultOpen />
        </div>
      </div>
    </article>
  );
}
