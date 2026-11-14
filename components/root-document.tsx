import type { ReactNode } from "react";
import { fontVariables } from "@/lib/fonts";
import type { Dictionary } from "@/lib/i18n/types";
import { SECTION_ID } from "@/lib/site";

interface RootDocumentProps {
  readonly dict: Dictionary;
  readonly children: ReactNode;
}

/** Shared <html> and <body> for the two language layouts, so each can set its own `lang`. */
export function RootDocument({ dict, children }: RootDocumentProps) {
  return (
    <html lang={dict.locale} className={`${fontVariables} antialiased`}>
      <body className="min-h-dvh bg-paper font-sans text-ink">
        <a
          href={`#${SECTION_ID.content}`}
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:bg-ink focus:px-4 focus:py-3 focus:font-mono focus:text-small focus:text-white"
        >
          {dict.skipToContent}
        </a>
        {children}
      </body>
    </html>
  );
}
