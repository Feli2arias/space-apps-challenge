// Contract: SiteFooter
// Props: dict (Dictionary, required)
// Variants: none
// States: links have default | hover (cinnabar) | focus-visible (outline)
// Accessibility: <footer> landmark; the language switch announces its target language;
//                white, muted and cinnabar text on ink are 17:1, 9.5:1 and 6.3:1
// Responsive: brand and notes sit side by side when there is room and stack below that

import Link from "next/link";
import { Container } from "@/components/ui/container";
import type { Dictionary } from "@/lib/i18n/types";
import { LOCALE_PATH, SECTION_ID } from "@/lib/site";

interface SiteFooterProps {
  readonly dict: Dictionary;
}

const LINK_CLASSES =
  "inline-flex min-h-11 items-center font-mono text-label tracking-label uppercase transition-colors hover:text-cinnabar";

export function SiteFooter({ dict }: SiteFooterProps) {
  const { footer, nav } = dict;

  return (
    <footer className="bg-ink pt-10 pb-12 text-white">
      <Container className="flex flex-wrap items-start justify-between gap-x-16 gap-y-10">
        <div className="min-w-0 flex-[1_1_20rem]">
          <p className="font-display text-title uppercase">Before the Seed</p>
          <p className="mt-3 text-body text-on-ink-muted">{footer.tagline}</p>
          <div className="mt-6 flex flex-wrap gap-x-8">
            <a href={`#${SECTION_ID.top}`} className={LINK_CLASSES}>
              {footer.backToTop}
            </a>
            <Link
              href={LOCALE_PATH[nav.otherLocale]}
              lang={nav.otherLocale}
              aria-label={nav.otherLocaleAria}
              className={LINK_CLASSES}
            >
              {nav.otherLocaleLabel}
            </Link>
          </div>
        </div>

        <div className="min-w-0 flex-[2_1_30rem] border-t border-line-on-ink pt-6">
          <p className="font-mono text-label tracking-label text-cinnabar uppercase">
            {footer.event}
          </p>
          <p className="mt-4 max-w-[70ch] text-small text-on-ink-muted">
            {footer.disclaimer}
          </p>
          <p className="mt-2 max-w-[70ch] text-small text-on-ink-muted">
            {footer.independence}
          </p>
        </div>
      </Container>
    </footer>
  );
}
