import type { Metadata } from "next";
import type { Dictionary } from "@/lib/i18n/types";
import { getSiteUrl, LOCALE_PATH, type Locale } from "@/lib/site";

const OPEN_GRAPH_LOCALE: Readonly<Record<Locale, string>> = {
  es: "es_CR",
  en: "en_US",
};

/** Page metadata for one language, with absolute links to both language versions. */
export function createMetadata(dict: Dictionary): Metadata {
  const siteUrl = getSiteUrl();
  const absolute = (locale: Locale) => new URL(LOCALE_PATH[locale], siteUrl).toString();

  return {
    metadataBase: siteUrl,
    title: dict.meta.title,
    description: dict.meta.description,
    alternates: {
      canonical: absolute(dict.locale),
      languages: {
        es: absolute("es"),
        en: absolute("en"),
        "x-default": absolute("es"),
      },
    },
    openGraph: {
      title: dict.meta.title,
      description: dict.meta.description,
      url: absolute(dict.locale),
      siteName: "Before the Seed",
      locale: OPEN_GRAPH_LOCALE[dict.locale],
      type: "website",
    },
  };
}
