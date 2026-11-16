// Contract: Hero
// Props: dict (Dictionary, required)
// Variants: none
// States: the first call to action opens the app (the "how it works" section while DEMO_URL
//         is null); static content; the two canvases animate only while visible and when motion is allowed
// Accessibility: holds the page's only h1; both canvases are decorative and hidden from
//                assistive tech; the highlighted line is ink on cinnabar (6.3:1)
// Responsive: headline scales with the viewport; the side rails appear from lg (1024px);
//             calls to action wrap and centre on small screens

import { PixelCanvas } from "@/components/pixel/pixel-canvas";
import { Container } from "@/components/ui/container";
import { PixelLink } from "@/components/ui/pixel-link";
import type { Dictionary } from "@/lib/i18n/types";
import { DEMO_URL, SECTION_ID } from "@/lib/site";
import { SiteNav } from "./site-nav";

interface HeroProps {
  readonly dict: Dictionary;
}

const RAIL_CLASSES =
  "lg:before:absolute lg:before:top-0 lg:before:-bottom-land lg:before:left-rail lg:before:w-px lg:before:bg-line " +
  "lg:after:absolute lg:after:top-0 lg:after:right-rail lg:after:-bottom-land lg:after:w-px lg:after:bg-line";

export function Hero({ dict }: HeroProps) {
  const { hero, sources } = dict;

  return (
    <section id={SECTION_ID.top} className="relative isolate overflow-hidden bg-paper">
      <PixelCanvas scene="sky" className="absolute inset-0 -z-10" />

      <Container>
        <SiteNav dict={dict} />

        <div
          className={`relative flex flex-col items-center pt-10 pb-8 text-center lg:pt-11 lg:pb-10 ${RAIL_CLASSES}`}
        >
          <h1 className="font-display text-display font-normal tracking-display uppercase">
            {hero.titleLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
            <span className="block">
              <span className="mt-[0.12em] inline-block bg-cinnabar px-[0.2em] pt-[0.1em] pb-[0.04em] shadow-pixel">
                {hero.titleHighlight}
              </span>
            </span>
          </h1>

          <p className="mt-6 max-w-[48ch] text-lead text-muted">{hero.lead}</p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
            <PixelLink href={DEMO_URL ? DEMO_URL[dict.locale] : `#${SECTION_ID.how}`} withArrow>
              {hero.primaryCta}
            </PixelLink>
            <PixelLink href={`#${SECTION_ID.rotations}`} variant="outline">
              {hero.secondaryCta}
            </PixelLink>
            <p className="max-w-[32ch] font-mono text-label tracking-label text-muted uppercase lg:text-left">
              {hero.note}
            </p>
          </div>
        </div>
      </Container>

      <div className="pointer-events-none relative h-land">
        <PixelCanvas scene="hero-field" />
      </div>

      <div className="relative bg-ink">
        <Container className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 pt-8 pb-8">
          <span className="font-mono text-label tracking-label text-cinnabar uppercase">
            {sources.label}
          </span>
          <ul className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-white">
            {sources.items.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-body font-semibold">
                <span className="size-2 bg-cinnabar" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </Container>
      </div>
    </section>
  );
}
