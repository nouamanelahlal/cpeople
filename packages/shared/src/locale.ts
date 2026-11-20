/**
 * The languages CPeople ships in (M23). Arabic with right-to-left comes after the
 * MVP, which is why the UI uses logical CSS properties throughout.
 */
export const LOCALES = ['en', 'fr'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** The locale this value names, or the default. Never throws: a bad cookie or a
 * stale token should not stop someone signing in. */
export function toLocale(value: string | null | undefined): Locale {
  const candidate = value?.trim().toLowerCase().split('-')[0];
  return LOCALES.includes(candidate as Locale) ? (candidate as Locale) : DEFAULT_LOCALE;
}
