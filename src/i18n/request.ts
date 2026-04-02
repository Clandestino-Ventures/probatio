/**
 * PROBATIO — next-intl Request Configuration
 *
 * Provides the locale and messages for each request.
 * next-intl v4 uses this file to resolve translations
 * in Server Components via the `createNextIntlPlugin` setup.
 */

import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

const SUPPORTED_LOCALES = ["en", "es"] as const;
const DEFAULT_LOCALE = "en" as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function isSupportedLocale(locale: string): locale is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

/**
 * Static imports so the bundler can resolve both JSON files at build time.
 * Dynamic `import(`@/messages/${locale}.json`)` fails because webpack/turbopack
 * cannot statically analyze template-literal path aliases.
 */
async function loadMessages(locale: SupportedLocale) {
  switch (locale) {
    case "es":
      return (await import("@/messages/es.json")).default;
    case "en":
    default:
      return (await import("@/messages/en.json")).default;
  }
}

export default getRequestConfig(async () => {
  // Read locale from the cookie set by middleware, or fall back to the header.
  const cookieStore = await cookies();
  const headerStore = await headers();

  let locale: SupportedLocale = DEFAULT_LOCALE;

  const cookieLocale = cookieStore.get("SPECTRA_LOCALE")?.value;
  if (cookieLocale && isSupportedLocale(cookieLocale)) {
    locale = cookieLocale;
  } else {
    const headerLocale = headerStore.get("x-spectra-locale");
    if (headerLocale && isSupportedLocale(headerLocale)) {
      locale = headerLocale;
    }
  }

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
