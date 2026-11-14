// Contract: AppHeader
// Props: dict (WorkspaceDictionary["header"], required) — translated labels
//        locale (Locale, required) — language of the page, to build the two links
// Variants: none
// States: links have default | hover (cinnabar-deep) | focus-visible (outline)
// Accessibility: <header> with a <nav> landmark and a translated label; the brand is a
//                link to the landing page with a full accessible name; the language switch
//                announces the target language in that language (lang + aria-label).
//                Every link is at least 44px tall.
// Responsive: one row at every width. The written "home" link hides below sm (640px),
//             where the brand link does the same job; the language switch always shows,
//             because this screen has no footer to repeat it in.

import Link from "next/link";
import { PixelIcon } from "@/components/ui/pixel-icon";
import { APP_PATH, type WorkspaceDictionary } from "@/lib/i18n/app/workspace";
import { LOCALE_PATH, type Locale } from "@/lib/site";

interface AppHeaderProps {
  readonly dict: WorkspaceDictionary["header"];
  readonly locale: Locale;
}

const TEXT_LINK_CLASSES =
  "min-h-11 items-center px-1 font-mono text-label tracking-label text-muted uppercase transition-colors hover:text-cinnabar-deep";

export function AppHeader({ dict, locale }: AppHeaderProps) {
  return (
    <header className="shrink-0 border-b border-ink bg-paper px-gutter">
      <nav aria-label={dict.ariaLabel} className="flex items-center justify-between gap-4 py-3">
        <Link
          href={LOCALE_PATH[locale]}
          aria-label={dict.homeAria}
          className="flex min-h-11 items-center gap-3 font-mono text-small font-semibold tracking-brand whitespace-nowrap uppercase"
        >
          <span className="grid size-7 place-items-center bg-cinnabar text-ink shadow-pixel-sm">
            <PixelIcon name="seed" className="size-4" />
          </span>
          <span>
            Before <span className="font-normal text-muted">the Seed</span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <Link href={LOCALE_PATH[locale]} className={`hidden sm:inline-flex ${TEXT_LINK_CLASSES}`}>
            {dict.home}
          </Link>
          <Link
            href={APP_PATH[dict.otherLocale]}
            lang={dict.otherLocale}
            aria-label={dict.otherLocaleAria}
            className={`inline-flex ${TEXT_LINK_CLASSES}`}
          >
            {dict.otherLocaleLabel}
          </Link>
        </div>
      </nav>
    </header>
  );
}
