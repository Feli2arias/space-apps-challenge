/**
 * Link to the working prototype in each language. While it is `null` the landing
 * page says the demo is still being built instead of showing a button that leads
 * nowhere.
 */
export const DEMO_URL: Readonly<Record<Locale, string>> | null = {
  es: "/app",
  en: "/en/app",
};

/** Anchor ids shared by both languages, so links keep working when switching. */
export const SECTION_ID = {
  top: "top",
  content: "contenido",
  problem: "problema",
  how: "como-funciona",
  analyses: "analisis",
  rotations: "rotaciones",
  data: "datos",
  demo: "demo",
} as const;

export type SectionKey = keyof typeof SECTION_ID;

export const LOCALE_PATH = {
  es: "/",
  en: "/en",
} as const;

export type Locale = keyof typeof LOCALE_PATH;

const LOCAL_URL = "http://localhost:3000";

/**
 * Public address of the site, used for absolute links in the page metadata.
 * Set NEXT_PUBLIC_SITE_URL when deploying; on Vercel the production domain is picked up
 * automatically.
 */
export function getSiteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);
  const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelDomain) return new URL(`https://${vercelDomain}`);
  return new URL(LOCAL_URL);
}
