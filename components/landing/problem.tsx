// Contract: Problem
// Props: dict (Dictionary, required)
// Variants: none
// States: cards have default | hover (surface turns white, in two steps)
// Accessibility: section labelled by its h2; each card is an article with an h3; numerals
//                use cinnabar-deep (4.75:1 on paper); icons are decorative
// Responsive: cards auto-fit (minimum 15rem): one column on phones, two on tablets, four on desktop

import { Container } from "@/components/ui/container";
import { OriginTag } from "@/components/ui/origin-tag";
import { PixelIcon } from "@/components/ui/pixel-icon";
import { SectionHeader } from "@/components/ui/section-header";
import type { Dictionary } from "@/lib/i18n/types";
import { SECTION_ID } from "@/lib/site";

interface ProblemProps {
  readonly dict: Dictionary;
}

const TITLE_ID = "problem-title";

export function Problem({ dict }: ProblemProps) {
  const { problem, origins } = dict;

  return (
    <section
      id={SECTION_ID.problem}
      aria-labelledby={TITLE_ID}
      className="pt-section pb-section"
    >
      <Container>
        <SectionHeader
          index="01"
          eyebrow={problem.eyebrow}
          title={problem.title}
          titleId={TITLE_ID}
          intro={problem.intro}
          divided
        />

        <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] border-l border-line">
          {problem.cards.map((card, index) => (
            <article
              key={card.title}
              className="flex min-h-80 flex-col gap-4 border-r border-b border-line px-6 pt-7 pb-8 transition-colors hover:bg-white"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="grid size-14 -rotate-6 place-items-center bg-cinnabar text-ink shadow-pixel-sm">
                  <PixelIcon name={card.icon} className="size-7" />
                </span>
                <span className="font-display text-numeral text-cinnabar-deep">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-2 text-h3 font-semibold">{card.title}</h3>
              <p className="grow text-body text-muted">{card.body}</p>
              <p className="border-t border-dashed border-line pt-3.5">
                <OriginTag origin={card.origin} label={origins[card.origin].label} />
              </p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
