// Contract: Analyses
// Props: dict (Dictionary, required)
// Variants: none
// States: static
// Accessibility: section labelled by its h2; each analysis is an article; every chart value
//                is written as text and each chart states its source and origin; text on ink
//                is 17:1 (white) and 9.5:1 (muted); chart panels are ink on white
// Responsive: one column below lg (1024px), two columns from lg up

import { Container } from "@/components/ui/container";
import { OriginTag } from "@/components/ui/origin-tag";
import { PixelBars } from "@/components/ui/pixel-bars";
import { SectionHeader } from "@/components/ui/section-header";
import type { Dictionary } from "@/lib/i18n/types";
import { SECTION_ID } from "@/lib/site";

interface AnalysesProps {
  readonly dict: Dictionary;
}

const TITLE_ID = "analyses-title";

export function Analyses({ dict }: AnalysesProps) {
  const { analyses, origins } = dict;

  return (
    <section
      id={SECTION_ID.analyses}
      aria-labelledby={TITLE_ID}
      className="bg-ink py-section text-white"
    >
      <Container>
        <SectionHeader
          index="03"
          eyebrow={analyses.eyebrow}
          title={analyses.title}
          titleId={TITLE_ID}
          intro={analyses.intro}
          tone="ink"
        />

        <div className="grid gap-x-10 gap-y-14 lg:grid-cols-2">
          {analyses.items.map((item) => (
            <article key={item.letter} className="flex flex-col">
              <div className="flex items-center gap-5">
                <span className="grid size-14 shrink-0 -rotate-6 place-items-center bg-cinnabar font-display text-numeral text-ink">
                  {item.letter}
                </span>
                <h3 className="font-display text-title font-normal uppercase">
                  {item.title}
                </h3>
              </div>

              <p className="mt-6 text-body text-on-ink-muted">{item.body}</p>

              <div className="mt-8 mr-1.5 grow bg-white p-5 text-ink shadow-pixel-accent sm:p-6">
                <p className="mb-5 font-mono text-label tracking-label text-muted uppercase">
                  {item.chartTitle}
                </p>
                <PixelBars bars={item.bars} />
                <div className="mt-6 border-t border-dashed border-line pt-4">
                  <OriginTag
                    origin={item.origin}
                    label={origins[item.origin].label}
                    className="text-cinnabar-deep"
                  />
                  <p className="mt-2 text-small text-muted">{item.source}</p>
                </div>
              </div>

              <p className="mt-7 border-l-2 border-cinnabar pl-4 text-small text-on-ink-muted">
                {item.caveat}
              </p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
