// Contract: StatBand
// Props: dict (Dictionary, required)
// Variants: none
// States: static; empty list renders an empty band
// Accessibility: a labelled section with a description list; white and muted text on ink
//                are 17:1 and 9.5:1
// Responsive: columns auto-fit (minimum 13.75rem), from one column on phones to four on desktop

import type { Dictionary } from "@/lib/i18n/types";

interface StatBandProps {
  readonly dict: Dictionary;
}

export function StatBand({ dict }: StatBandProps) {
  const { stats } = dict;

  return (
    <section
      aria-label={stats.ariaLabel}
      className="border-t border-line-on-ink bg-ink text-white"
    >
      <dl className="mx-auto grid max-w-page grid-cols-[repeat(auto-fit,minmax(13.75rem,1fr))]">
        {stats.items.map((stat) => (
          <div
            key={stat.value}
            className="flex flex-col-reverse justify-end border-r border-line-on-ink px-gutter py-7 last:border-r-0"
          >
            <dt className="mt-2.5 text-small text-on-ink-muted">{stat.label}</dt>
            <dd className="font-display text-stat">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
