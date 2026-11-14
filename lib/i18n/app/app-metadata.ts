import type { Metadata } from "next";
import { getSiteUrl, type Locale } from "@/lib/site";
import { APP_PATH, getWorkspaceDictionary } from "./workspace";

const OPEN_GRAPH_LOCALE: Readonly<Record<Locale, string>> = {
  es: "es_CR",
  en: "en_US",
};

/**
 * Metadata of the analysis screen in one language. It replaces the title,
 * description and language links the root layout sets for the landing page,
 * so search engines pair /app with /en/app and not with the home pages.
 */
export function createAppMetadata(locale: Locale): Metadata {
  const { meta } = getWorkspaceDictionary(locale);
  const siteUrl = getSiteUrl();
  const absolute = (target: Locale) => new URL(APP_PATH[target], siteUrl).toString();

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: absolute(locale),
      languages: {
        es: absolute("es"),
        en: absolute("en"),
        "x-default": absolute("es"),
      },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: absolute(locale),
      siteName: "Before the Seed",
      locale: OPEN_GRAPH_LOCALE[locale],
      type: "website",
    },
  };
}
