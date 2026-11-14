"use client";

import { useSyncExternalStore } from "react";
import { LOCALE_PATH, type Locale } from "@/lib/site";

/** The site's default language, used on the server where there is no document. */
const DEFAULT_LOCALE: Locale = "es";

/** The document's language never changes after load, so there is nothing to listen to. */
function subscribe(): () => void {
  return () => {};
}

function readDocumentLocale(): Locale {
  const language = document.documentElement.lang.toLowerCase().split("-")[0];
  return Object.hasOwn(LOCALE_PATH, language) ? (language as Locale) : DEFAULT_LOCALE;
}

function readServerLocale(): Locale {
  return DEFAULT_LOCALE;
}

/**
 * The language of the page, read from `<html lang>`, which each language layout
 * sets. It lets a component that only receives translated strings still name a
 * handful of fixed states in the right language.
 */
export function useDocumentLocale(): Locale {
  return useSyncExternalStore(subscribe, readDocumentLocale, readServerLocale);
}
