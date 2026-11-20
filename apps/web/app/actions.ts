'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { toLocale } from '@cpeople/shared';
import { safeCallbackUrl } from '../lib/flow-cookie';
import { LOCALE_COOKIE } from '../lib/locale';

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Remembers the visitor's language before they sign in. Keycloak is told about it
 * as `ui_locales` when sign-in starts, and whatever language they end up with comes
 * back in the token and is written here again (M23).
 *
 * It redirects afterwards rather than falling through: the page was rendered from
 * the old cookie, so it has to be rendered again to come back in the new language.
 */
export async function chooseLocale(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale')?.toString());
  const returnTo = safeCallbackUrl(formData.get('returnTo')?.toString(), '/');

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { path: '/', maxAge: ONE_YEAR, sameSite: 'lax' });

  redirect(returnTo);
}
