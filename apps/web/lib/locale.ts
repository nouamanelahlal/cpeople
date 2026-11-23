import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, getMessages, toLocale, type Locale, type Messages } from '@cpeople/shared';

/** Where the language choice is kept before someone signs in. */
export const LOCALE_COOKIE = 'cpeople_locale';

/**
 * The language to render in.
 *
 * Before sign-in this is the visitor's own choice, kept in a cookie and passed to
 * Keycloak as ui_locales. After sign-in the language chosen in Keycloak wins, and
 * the sign-in callback writes it back into the same cookie (M23).
 */
export async function currentLocale(): Promise<Locale> {
  const store = await cookies();
  return toLocale(store.get(LOCALE_COOKIE)?.value ?? DEFAULT_LOCALE);
}

export async function currentMessages(): Promise<{ locale: Locale; t: Messages }> {
  const locale = await currentLocale();
  return { locale, t: getMessages(locale) };
}

/** Fills {name}-style placeholders. */
export function format(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
