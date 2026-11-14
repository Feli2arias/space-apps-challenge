import type { Locale, SectionKey } from "@/lib/site";

/** Where a number comes from. Every figure on the page carries one of these. */
export type Origin = "observed" | "modeled" | "declared" | "study";

export type IconName = "rain" | "bare" | "slope" | "sprout";

export type BarTone = "accent" | "ink";

export type CropKind = "previous" | "cover" | "target";

export interface NavLink {
  readonly section: SectionKey;
  readonly label: string;
}

export interface SectionHeading {
  readonly eyebrow: string;
  readonly title: readonly string[];
  readonly intro: string;
}

export interface Stat {
  readonly value: string;
  readonly label: string;
}

export interface ProblemCard {
  readonly icon: IconName;
  readonly title: string;
  readonly body: string;
  readonly origin: Origin;
}

export interface Step {
  readonly title: string;
  readonly body: string;
}

export interface Bar {
  readonly label: string;
  /** Numeric value, identical in every language. */
  readonly value: number;
  /** Value as written for the reader, with the local decimal separator. */
  readonly display: string;
  readonly tone: BarTone;
}

export interface Analysis {
  readonly letter: string;
  readonly title: string;
  readonly body: string;
  readonly chartTitle: string;
  readonly bars: readonly Bar[];
  readonly source: string;
  readonly origin: Origin;
  readonly caveat: string;
}

export interface Crop {
  readonly label: string;
  readonly kind: CropKind;
}

export interface Rotation {
  readonly code: string;
  readonly badge: string | null;
  readonly sequence: readonly Crop[];
  readonly evidence: string;
  readonly origin: Origin;
  readonly gaps: string;
}

export interface DataRow {
  readonly resolution: string;
  readonly what: string;
  readonly source: string;
  readonly scope: string;
  readonly limit: string;
}

export interface OriginInfo {
  readonly label: string;
  readonly description: string;
}

export interface Dictionary {
  readonly locale: Locale;
  readonly meta: {
    readonly title: string;
    readonly description: string;
  };
  readonly skipToContent: string;
  readonly nav: {
    readonly ariaLabel: string;
    readonly links: readonly NavLink[];
    readonly cta: string;
    readonly otherLocale: Locale;
    readonly otherLocaleLabel: string;
    readonly otherLocaleAria: string;
  };
  readonly hero: {
    readonly titleLines: readonly string[];
    readonly titleHighlight: string;
    readonly lead: string;
    readonly primaryCta: string;
    readonly secondaryCta: string;
    readonly note: string;
  };
  readonly sources: {
    readonly label: string;
    readonly items: readonly string[];
  };
  readonly stats: {
    readonly ariaLabel: string;
    readonly items: readonly Stat[];
  };
  readonly origins: Readonly<Record<Origin, OriginInfo>>;
  readonly problem: SectionHeading & {
    readonly cards: readonly ProblemCard[];
  };
  readonly how: SectionHeading & {
    readonly steps: readonly Step[];
  };
  readonly analyses: SectionHeading & {
    readonly items: readonly Analysis[];
  };
  readonly rotations: SectionHeading & {
    readonly rotationLabel: string;
    readonly sequenceAria: string;
    readonly evidenceLabel: string;
    readonly gapsLabel: string;
    readonly cards: readonly Rotation[];
    readonly disclaimer: string;
  };
  readonly data: SectionHeading & {
    readonly resolutionLabel: string;
    readonly rows: readonly DataRow[];
    readonly sees: { readonly title: string; readonly items: readonly string[] };
    readonly blind: {
      readonly title: string;
      readonly items: readonly string[];
      readonly note: string;
    };
    readonly originsTitle: string;
  };
  readonly demo: {
    readonly title: readonly string[];
    readonly lead: string;
    readonly scope: string;
    readonly windowTitle: string;
    readonly steps: readonly string[];
    readonly openCta: string;
    readonly pending: string;
  };
  readonly footer: {
    readonly tagline: string;
    readonly event: string;
    readonly disclaimer: string;
    readonly independence: string;
    readonly backToTop: string;
  };
}
