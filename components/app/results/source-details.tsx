// Contract: SourceDetails
// Props: result (SourceResult, required) — product, quality, codes and error of one source
//        messages (SourceMessages | null, required) — the source's catalogue, for the
//          sentences behind limitation, quality-note and conversion codes
//        intro (string | null, optional) — the source's own technical description
//        defaultOpen (boolean, optional) — start unfolded (inside an opened card)
//        dict (ResultsDictionary, required)
// Variants: none
// States: closed (default) | open (or open from the start with defaultOpen) — a native <details>, so it works without JavaScript.
//         Any field the source did not send reads "sin dato"; a code with no sentence in the
//         catalogue is shown as the raw code in mono type; the technical error detail only
//         appears here, never as a headline.
// Accessibility: native disclosure, keyboard-operable, 44px summary; content is a definition
//                list; the documentation link names where it goes and opens in a new tab
// Responsive: term above its value; two columns of fields when the panel is wide (@2xl);
//             long codes and addresses break

import type { ReactNode } from "react";
import { PixelIcon } from "@/components/ui/pixel-icon";
import {
  formatDateRange,
  formatDistance,
  formatDuration,
  formatNumber,
  formatShare,
} from "@/lib/analysis/format";
import type { Quality, SourceMessages, SourceResult } from "@/lib/analysis/types";
import { fill, type ResultsDictionary } from "@/lib/i18n/app/results";
import { cn } from "@/lib/cn";
import { presentText, resolveCode } from "./messages";
import { toHttpUrl } from "./view-model";

/** Shared look of the panel's collapsed sections ("Más detalles", "Fuentes y limitaciones"). */
const DISCLOSURE_CLASSES = "group border-t border-line";
const DISCLOSURE_SUMMARY_CLASSES =
  "flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-mono text-label font-semibold tracking-label uppercase [&::-webkit-details-marker]:hidden";

interface SourceDetailsProps {
  readonly result: SourceResult<unknown>;
  readonly messages: SourceMessages | null;
  readonly intro?: string | null;
  readonly dict: ResultsDictionary;
  /** Starts unfolded, e.g. inside an opened card; it can still be folded. */
  readonly defaultOpen?: boolean;
}

interface FieldProps {
  readonly term: string;
  readonly children: ReactNode;
}

function Field({ term, children }: FieldProps) {
  return (
    <div>
      <dt className="font-mono text-label tracking-label text-muted uppercase">{term}</dt>
      <dd className="mt-1 text-small wrap-anywhere">{children}</dd>
    </div>
  );
}

interface CodeListProps {
  readonly codes: readonly string[] | null | undefined;
  readonly table: unknown;
  readonly emptyText: string;
}

/** Sentences for a list of codes; a code without a sentence is shown as the code itself. */
function CodeList({ codes, table, emptyText }: CodeListProps) {
  const entries = (codes ?? []).map((code) => ({ code, ...resolveCode(table, String(code)) }));
  if (entries.length === 0) return <span className="text-muted">{emptyText}</span>;

  return (
    <ul className="flex flex-col gap-1.5">
      {entries.map((entry) => (
        <li key={entry.code} className={cn(!entry.known && "font-mono text-label")}>
          {entry.text}
        </li>
      ))}
    </ul>
  );
}

function qualityText(quality: Quality | null, dict: ResultsDictionary): string {
  const valid = formatNumber(quality?.valid, dict.locale);
  if (valid === null) return dict.missing;
  const expected = formatNumber(quality?.expected, dict.locale);
  const counts =
    expected === null
      ? fill(dict.details.validOnly, { valid })
      : fill(dict.details.validOfExpected, { valid, expected });
  const coverage = formatShare(quality?.coverage, dict.locale);
  return coverage === null ? counts : `${counts}; ${fill(dict.details.coverage, { coverage })}`;
}

export function SourceDetails({ result, messages, intro, dict, defaultOpen = false }: SourceDetailsProps) {
  const { details, locale } = dict;
  const product = result.product ?? null;
  const documentationUrl = toHttpUrl(product?.documentationUrl);
  const temporal = product?.temporalResolution;
  const errorDetail = presentText(result.error?.detail);

  return (
    <details className={DISCLOSURE_CLASSES} open={defaultOpen}>
      <summary className={DISCLOSURE_SUMMARY_CLASSES}>
        {details.summary}
        <PixelIcon name="arrow" className="h-2.5 w-3 rotate-90 group-open:-rotate-90" />
      </summary>

      {intro ? <p className="max-w-[70ch] pt-2 text-body text-muted">{intro}</p> : null}
      <dl className="grid gap-x-8 gap-y-4 pt-3 pb-4 @2xl:grid-cols-2">
        <Field term={details.product}>
          {presentText(product?.name) ?? dict.missing}
          {presentText(product?.id) ? (
            <span className="block font-mono text-label text-muted">{product?.id}</span>
          ) : null}
        </Field>
        <Field term={details.version}>{presentText(product?.version) ?? dict.missing}</Field>
        <Field term={details.provider}>{presentText(product?.provider) ?? dict.missing}</Field>
        <Field term={details.accessedVia}>{presentText(product?.accessedVia) ?? dict.missing}</Field>
        <Field term={details.pixelSize}>
          {formatDistance(product?.spatialResolutionMeters, locale) ?? dict.missing}
        </Field>
        <Field term={details.temporalResolution}>
          {temporal && Object.hasOwn(dict.temporal, temporal)
            ? dict.temporal[temporal]
            : (presentText(temporal) ?? dict.missing)}
        </Field>
        <Field term={details.period}>
          {formatDateRange(result.period, locale) ??
            (temporal === "static" ? details.periodStatic : dict.missing)}
        </Field>
        <Field term={details.documentation}>
          {documentationUrl ? (
            <a
              href={documentationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              {details.documentationLink}
            </a>
          ) : (
            dict.missing
          )}
        </Field>
        <Field term={details.quality}>{qualityText(result.quality, dict)}</Field>
        <Field term={details.qualityNotes}>
          <CodeList
            codes={result.quality?.notes}
            table={messages?.qualityNotes}
            emptyText={details.noneDeclared}
          />
        </Field>
        <Field term={details.limitations}>
          <CodeList
            codes={result.limitations}
            table={messages?.limitations}
            emptyText={details.noneDeclared}
          />
        </Field>
        <Field term={details.conversions}>
          <CodeList
            codes={result.conversions}
            table={messages?.conversions}
            emptyText={details.noneDeclared}
          />
        </Field>
        <Field term={details.duration}>
          {formatDuration(result.durationMs, locale) ?? dict.missing}
        </Field>
        {errorDetail ? (
          <Field term={details.errorDetail}>
            <code className="block bg-mist p-2 font-mono text-label">
              {result.error?.code}: {errorDetail}
            </code>
          </Field>
        ) : null}
      </dl>
    </details>
  );
}
