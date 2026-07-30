import 'server-only';

import { cookies } from 'next/headers';

import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from './config';
import { en, type Dictionary } from './en';
import { ne } from './ne';

/*
 * Server-side locale resolution.
 *
 * Both dictionaries are plain objects imported at build time rather than
 * dynamic imports, because they are a few kilobytes each and this runs on the
 * server: there is no bundle to keep small, and a synchronous lookup keeps
 * every call site free of await.
 *
 * TRADE-OFF, deliberate and worth knowing: reading the locale cookie opts a
 * route into dynamic rendering, so pages that translate can no longer sit in
 * the ISR cache. Getting both caching and translation back means putting the
 * locale in the URL (/ne/...), which also makes the Nepali pages indexable.
 * That is the right next step, and it is a routing change rather than a copy
 * change, so it is kept separate from this one.
 */
const DICTIONARIES: Record<Locale, Dictionary> = { en, ne };

/** The caller's locale, from the cookie, falling back to English. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getDictionary(): Promise<Dictionary> {
  return DICTIONARIES[await getLocale()];
}

/** Both at once, for the common case where a layout needs `lang` as well. */
export async function getTranslation(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = await getLocale();
  return { locale, t: DICTIONARIES[locale] };
}

export type { Dictionary };
