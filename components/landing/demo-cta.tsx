// Contract: DemoCta
// Props: dict (Dictionary, required)
// Variants: none
// States: demo available (DEMO_URL set: shows the "open" link) | demo pending (DEMO_URL null:
//         shows a plain status line, never a dead link)
// Accessibility: section labelled by its h2; the steps are an ordered list; the closing
//                canvas is decorative; ink and dark-cinnabar text on cinnabar are 6.3:1 and 5.5:1
// Responsive: copy and step window sit side by side when there is room and stack below that

import { PixelCanvas } from "@/components/pixel/pixel-canvas";
import { Container } from "@/components/ui/container";
import { PixelLink } from "@/components/ui/pixel-link";
import type { Dictionary } from "@/lib/i18n/types";
import { DEMO_URL, SECTION_ID } from "@/lib/site";

interface DemoCtaProps {
  readonly dict: Dictionary;
}

const TITLE_ID = "demo-title";

export function DemoCta({ dict }: DemoCtaProps) {
  const { demo } = dict;

  return (
    <section
      id={SECTION_ID.demo}
      aria-labelledby={TITLE_ID}
      className="relative overflow-hidden bg-cinnabar pt-section text-ink"
    >
      <Container className="flex flex-wrap items-center gap-x-20 gap-y-12">
        <div className="min-w-0 flex-[1_1_22.5rem]">
          <h2
            id={TITLE_ID}
            className="font-display text-h2 font-normal tracking-display uppercase"
          >
            {demo.title.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h2>
          <p className="mt-6 max-w-md text-lead">{demo.lead}</p>
          <p className="mt-4 max-w-md text-body text-on-cinnabar-muted">{demo.scope}</p>

          <div className="mt-8">
            {DEMO_URL ? (
              <PixelLink href={DEMO_URL} variant="ink" withArrow>
                {demo.openCta}
              </PixelLink>
            ) : (
              <p className="inline-flex min-h-11 items-center gap-3 border border-dashed border-ink px-4 font-mono text-label tracking-label uppercase">
                <span className="size-2 bg-ink" aria-hidden="true" />
                {demo.pending}
              </p>
            )}
          </div>
        </div>

        <div className="mr-2 min-w-0 flex-[1_1_26rem] bg-white shadow-pixel-lg">
          <div className="flex items-center gap-3 border-b border-line px-6 py-3">
            <span className="flex gap-1.5" aria-hidden="true">
              <span className="size-2.5 bg-cinnabar" />
              <span className="size-2.5 bg-stone" />
              <span className="size-2.5 bg-ink" />
            </span>
            <span className="font-mono text-label tracking-brand text-muted uppercase">
              {demo.windowTitle}
            </span>
          </div>
          <ol className="px-6 py-3">
            {demo.steps.map((step, index) => (
              <li
                key={step}
                className="flex items-center gap-4 border-b border-line py-3.5 text-body font-medium last:border-b-0"
              >
                <span className="font-mono text-label text-cinnabar-deep">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </Container>

      <div className="pointer-events-none mt-12 h-land">
        <PixelCanvas scene="closing-field" />
      </div>
    </section>
  );
}
