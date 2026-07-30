/**
 * Locale configuration.
 *
 * Two locales, English and Nepali. The choice is stored in a cookie so it
 * survives across visits, and mirrored onto profiles.preferred_locale for
 * signed-in users so it follows them to another device.
 *
 * Nepali here is the register people actually speak and read in listings, not
 * formal literary Nepali. Real estate in Nepal is घरजग्गा, not आवासीय सम्पत्ति,
 * and loanwords like अपार्टमेन्ट and बेडरुम are what buyers use out loud. Writing
 * "correct" Sanskritised Nepali would defeat the point of translating at all.
 */
export const LOCALES = ['en', 'ne'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_COOKIE = 'kitta_locale';

/** One year. The choice is a preference, not a session detail. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ne: 'नेपाली',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
