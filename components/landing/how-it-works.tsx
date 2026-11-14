// Contract: HowItWorks
// Props: dict (Dictionary, required)
// Variants: none
// States: static
// Accessibility: section labelled by its h2; steps are an ordered list so their sequence is
//                announced; ink and dark-cinnabar text on cinnabar are 6.3:1 and 5.5:1
// Responsive: steps auto-fit (minimum 13.75rem): stacked on phones, five across on desktop;
//             the dashed connector follows each number

import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import type { Dictionary } from "@/lib/i18n/types";
import { SECTION_ID } from "@/lib/site";

interface HowItWorksProps {
  readonly dict: Dictionary;
}

const TITLE_ID = "how-title";

export function HowItWorks({ dict }: HowItWorksProps) {
  const { how } = dict;

  return (
    <section
      id={SECTION_ID.how}
      aria-labelledby={TITLE_ID}
      className="bg-cinnabar py-section text-ink"
    >
      <Container>
        <SectionHeader
          index="02"
          eyebrow={how.eyebrow}
          title={how.title}
          titleId={TITLE_ID}
          intro={how.intro}
          tone="accent"
        />

        <ol className="grid grid-cols-[repeat(auto-fit,minmax(13.75rem,1fr))] gap-y-8 pt-6">
          {how.steps.map((step, index) => (
            <li
              key={step.title}
              className="flex flex-col border-b border-line-on-cinnabar pb-8"
            >
              <div className="flex items-center">
                <span className="grid size-12 shrink-0 place-items-center bg-ink font-display text-title text-white">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="dash-rail h-1.5 grow text-ink" aria-hidden="true" />
              </div>
              <h3 className="mt-5 pr-6 text-h3 font-semibold">{step.title}</h3>
              <p className="mt-3 max-w-xs pr-6 text-body text-on-cinnabar-muted">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
