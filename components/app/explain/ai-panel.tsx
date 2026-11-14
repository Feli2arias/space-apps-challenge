// Contract: AiPanel
// Props: titleId (string, required) — id given to the heading, for aria-labelledby
//        title (string, required)
//        origin (string, required) — the "AI-generated" tag, always written out
//        children (ReactNode, required)
// Variants: none
// States: none of its own
// Accessibility: a section named by its h2; the origin tag is text, not only an icon
// Responsive: full width of its parent; heading and tag wrap on narrow screens

import type { ReactNode } from "react";
import { PixelIcon } from "@/components/ui/pixel-icon";

interface AiPanelProps {
  readonly titleId: string;
  readonly title: string;
  readonly origin: string;
  readonly children: ReactNode;
}

export function AiPanel({ titleId, title, origin, children }: AiPanelProps) {
  return (
    <section aria-labelledby={titleId} className="mr-1 border border-ink bg-white shadow-pixel-sm">
      <header className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-ink px-4 py-2.5 sm:px-6">
        <h2 id={titleId} className="font-mono text-small font-semibold tracking-brand uppercase">
          {title}
        </h2>
        <span className="inline-flex items-center gap-2 font-mono text-label tracking-label text-muted uppercase">
          <PixelIcon name="modeled" className="size-3" />
          {origin}
        </span>
      </header>
      <div className="flex flex-col gap-5 p-4 sm:p-6">{children}</div>
    </section>
  );
}
