// Contract: SectionHeader
// Props: index (string, required) — two-digit section number, e.g. "01"
//        eyebrow (string, required) — short label after the number
//        title (readonly string[], required) — heading, one entry per line
//        titleId (string, required) — id for the h2, used by aria-labelledby on the section
//        intro (string, optional) — paragraph shown beside the heading
//        tone ("light" | "accent" | "ink", optional, default "light") — the background it sits on
//        divided (boolean, optional, default false) — rule under the header
// Variants: tone changes the eyebrow and intro colours so they pass AA on each background
// States: static text only
// Accessibility: renders the section's h2; uppercase is applied with CSS so screen readers
//                read normal case; all tone combinations meet 4.5:1
// Responsive: heading and intro sit side by side when there is room and stack below that

import { cn } from "@/lib/cn";

export type SectionTone = "light" | "accent" | "ink";

interface SectionHeaderProps {
  readonly index: string;
  readonly eyebrow: string;
  readonly title: readonly string[];
  readonly titleId: string;
  readonly intro?: string;
  readonly tone?: SectionTone;
  readonly divided?: boolean;
}

const EYEBROW_CLASSES: Readonly<Record<SectionTone, string>> = {
  light: "text-cinnabar-deep",
  accent: "text-on-cinnabar-muted",
  ink: "text-cinnabar",
};

const INTRO_CLASSES: Readonly<Record<SectionTone, string>> = {
  light: "text-muted",
  accent: "text-on-cinnabar-muted",
  ink: "text-on-ink-muted",
};

const DIVIDER_CLASSES: Readonly<Record<SectionTone, string>> = {
  light: "border-line",
  accent: "border-line-on-cinnabar",
  ink: "border-line-on-ink",
};

export function SectionHeader({
  index,
  eyebrow,
  title,
  titleId,
  intro,
  tone = "light",
  divided = false,
}: SectionHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-8",
        divided ? cn("border-b pb-7", DIVIDER_CLASSES[tone]) : "mb-12",
      )}
    >
      <div>
        <p
          className={cn(
            "font-mono text-label tracking-label uppercase",
            EYEBROW_CLASSES[tone],
          )}
        >
          {index} — {eyebrow}
        </p>
        <h2
          id={titleId}
          className="mt-4 font-display text-h2 font-normal tracking-display uppercase"
        >
          {title.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h2>
      </div>
      {intro ? (
        <p className={cn("max-w-md text-body", INTRO_CLASSES[tone])}>{intro}</p>
      ) : null}
    </header>
  );
}
