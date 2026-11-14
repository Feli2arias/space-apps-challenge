// Contract: SiteNav
// Props: dict (Dictionary, required) — translated labels and links
// Variants: none
// States: links have default | hover (cinnabar-deep) | focus-visible (outline)
// Accessibility: <nav> landmark with a translated label; the language switch announces
//                the target language in that language (lang + aria-label)
// Responsive: below lg (1024px) section links hide and the brand, language switch and CTA
//             remain; below sm (640px) the language switch moves to the footer only

import Link from "next/link";
import { PixelIcon } from "@/components/ui/pixel-icon";
import { PixelLink } from "@/components/ui/pixel-link";
import type { Dictionary } from "@/lib/i18n/types";
import { LOCALE_PATH, SECTION_ID } from "@/lib/site";

interface SiteNavProps {
  readonly dict: Dictionary;
}

export function SiteNav({ dict }: SiteNavProps) {
  const { nav } = dict;

  return (
    <nav
      aria-label={nav.ariaLabel}
      className="flex items-center justify-between gap-4 border-b border-line py-5 xl:grid xl:grid-cols-[1fr_auto_1fr]"
    >
      <a
        href={`#${SECTION_ID.top}`}
        className="flex min-h-11 items-center gap-3 font-mono text-small font-semibold tracking-brand whitespace-nowrap uppercase"
      >
        <span className="grid size-7 place-items-center bg-cinnabar text-ink shadow-pixel-sm">
          <PixelIcon name="seed" className="size-4" />
        </span>
        <span>
          Before <span className="font-normal text-muted">the Seed</span>
        </span>
      </a>

      <ul className="hidden gap-6 font-mono text-label tracking-label uppercase lg:flex">
        {nav.links.map((link) => (
          <li key={link.section}>
            <a
              href={`#${SECTION_ID[link.section]}`}
              className="whitespace-nowrap text-muted transition-colors hover:text-cinnabar-deep"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-end gap-4">
        <Link
          href={LOCALE_PATH[nav.otherLocale]}
          lang={nav.otherLocale}
          aria-label={nav.otherLocaleAria}
          className="hidden min-h-11 items-center px-1 font-mono text-label tracking-label text-muted uppercase transition-colors hover:text-cinnabar-deep sm:inline-flex"
        >
          {nav.otherLocaleLabel}
        </Link>
        <PixelLink href={`#${SECTION_ID.demo}`} size="sm" withArrow>
          {nav.cta}
        </PixelLink>
      </div>
    </nav>
  );
}
