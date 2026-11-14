// Contract: Rotations
// Props: dict (Dictionary, required)
// Variants: crop blocks are "previous" (gray), "cover" (checkered) or "target" (cinnabar)
// States: static
// Accessibility: section labelled by its h2; each rotation is an article; the crop sequence
//                is an ordered list with a translated label; crop kind is never conveyed by
//                fill alone because every block carries its name; ink on cinnabar is 6.3:1
// Responsive: one column below md (768px), three columns from lg (1024px) up

import { Container } from "@/components/ui/container";
import { OriginTag } from "@/components/ui/origin-tag";
import { PixelIcon } from "@/components/ui/pixel-icon";
import { SectionHeader } from "@/components/ui/section-header";
import { cn } from "@/lib/cn";
import type { CropKind, Dictionary } from "@/lib/i18n/types";
import { SECTION_ID } from "@/lib/site";

interface RotationsProps {
  readonly dict: Dictionary;
}

const TITLE_ID = "rotations-title";

const CROP_CLASSES: Readonly<Record<CropKind, string>> = {
  previous: "bg-mist",
  cover: "checker bg-white text-stone",
  target: "bg-cinnabar",
};

export function Rotations({ dict }: RotationsProps) {
  const { rotations, origins } = dict;

  return (
    <section
      id={SECTION_ID.rotations}
      aria-labelledby={TITLE_ID}
      className="py-section"
    >
      <Container>
        <SectionHeader
          index="04"
          eyebrow={rotations.eyebrow}
          title={rotations.title}
          titleId={TITLE_ID}
          intro={rotations.intro}
        />

        <div className="grid gap-x-8 gap-y-10 lg:grid-cols-3">
          {rotations.cards.map((card) => (
            <article
              key={card.code}
              className="mr-2 flex flex-col border border-ink bg-white shadow-pixel-lg"
            >
              <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-ink px-5 py-2.5">
                <h3 className="font-mono text-label font-semibold tracking-brand uppercase">
                  {rotations.rotationLabel} {card.code}
                </h3>
                {card.badge ? (
                  <span className="bg-ink px-2 py-1 font-mono text-label tracking-label text-white uppercase">
                    {card.badge}
                  </span>
                ) : null}
              </div>

              <ol
                aria-label={rotations.sequenceAria}
                className="flex items-stretch gap-2 border-b border-line p-5"
              >
                {card.sequence.map((crop, index) => (
                  <li key={crop.label} className="flex flex-1 items-stretch gap-2">
                    {index > 0 ? (
                      <PixelIcon name="arrow" className="h-2.5 w-3 self-center" />
                    ) : null}
                    <span
                      className={cn(
                        "flex min-h-20 flex-1 items-end border border-ink p-2.5",
                        CROP_CLASSES[crop.kind],
                      )}
                    >
                      <span className="bg-white px-1 font-display text-h3 text-ink uppercase">
                        {crop.label}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>

              <div className="flex grow flex-col gap-6 p-5">
                <div>
                  <p className="font-mono text-label tracking-label text-cinnabar-deep uppercase">
                    {rotations.evidenceLabel}
                  </p>
                  <p className="mt-2 text-body">{card.evidence}</p>
                  <OriginTag
                    origin={card.origin}
                    label={origins[card.origin].label}
                    className="mt-3 text-muted"
                  />
                </div>
                <div className="border-t border-dashed border-line pt-5">
                  <p className="font-mono text-label tracking-label text-cinnabar-deep uppercase">
                    {rotations.gapsLabel}
                  </p>
                  <p className="mt-2 text-body text-muted">{card.gaps}</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-12 max-w-[60ch] border-l-2 border-cinnabar pl-4 text-body">
          {rotations.disclaimer}
        </p>
      </Container>
    </section>
  );
}
