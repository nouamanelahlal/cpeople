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

/**
 * The tag `Intl` formats with.
 *
 * British English rather than American, because that is how the client writes dates
 * and because "18 November 2026" is what the designs show; French as in France,
 * which formats Moroccan dirhams and dates exactly as HR staff in Morocco expect
 * ("1 284 650,00 MAD", "mercredi 18 novembre 2026").
 */
const INTL_LOCALES: Record<Locale, string> = { en: 'en-GB', fr: 'fr-FR' };

export function intlLocale(locale: Locale): string {
  return INTL_LOCALES[locale];
}

/** The only currency in the MVP, named once (CLAUDE.md rule 4). */
export const CURRENCY = 'MAD';
