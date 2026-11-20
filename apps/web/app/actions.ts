'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { toLocale } from '@cpeople/shared';
import { auth, signIn, signOut } from '../auth';
import { getAuthEnv } from '../lib/auth-env';
import { LOCALE_COOKIE } from '../lib/locale';

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Remembers the visitor's language before they sign in. */
export async function chooseLocale(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale')?.toString());
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { path: '/', maxAge: ONE_YEAR, sameSite: 'lax' });
}

/**
 * Starts sign-in, telling Keycloak which language to render its pages in.
 * Keycloak's own switcher can override it, and whatever the person ends up with
 * comes back in the token and is written to the cookie by the home page.
 */
export async function startSignIn(formData: FormData): Promise<void> {
  const store = await cookies();
  const locale = toLocale(store.get(LOCALE_COOKIE)?.value);
  const callbackUrl = formData.get('callbackUrl')?.toString() || '/home';

  await signIn('keycloak', { redirectTo: callbackUrl }, { ui_locales: locale });
}

/**
 * Ends this session and the Keycloak one.
 *
 * Signing out of the app alone would leave the Keycloak session open, so the next
 * person at the same machine would be signed straight back in without a password.
 */
export async function endSession(): Promise<void> {
  const session = await auth();
  const idToken = session?.idToken;

  await signOut({ redirect: false });

  const authEnv = getAuthEnv();
  const endSessionUrl = new URL(`${authEnv.issuer}/protocol/openid-connect/logout`);
  endSessionUrl.searchParams.set('post_logout_redirect_uri', `${authEnv.appUrl}/signed-out`);
  if (idToken) {
    endSessionUrl.searchParams.set('id_token_hint', idToken);
  } else {
    endSessionUrl.searchParams.set('client_id', authEnv.clientId);
  }

  redirect(endSessionUrl.toString());
}
