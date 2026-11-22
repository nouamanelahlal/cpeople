import { NextResponse, type NextRequest } from 'next/server';
import * as client from 'openid-client';
import { toLocale } from '@cpeople/shared';
import { safeCallbackUrl, writeFlowCookie } from '../../../../lib/flow-cookie';
import { LOCALE_COOKIE } from '../../../../lib/locale';
import { oidcConfig, redirectUri, SCOPE } from '../../../../lib/oidc';
import { preloadLayersHeader } from '../../../../lib/welcome';

/**
 * Starts sign-in: authorization code flow with PKCE (M02 / HR-08).
 *
 * The verifier never leaves this server — only its hash goes to Keycloak — so an
 * authorization code intercepted on the way back is useless to anyone else.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = await oidcConfig();

  const verifier = client.randomPKCECodeVerifier();
  const challenge = await client.calculatePKCECodeChallenge(verifier);
  const state = client.randomState();
  const callbackUrl = safeCallbackUrl(request.nextUrl.searchParams.get('callbackUrl'));

  // Keycloak renders its pages in the language the visitor picked here; once it
  // knows who they are it switches to that user's own language.
  const locale = toLocale(request.cookies.get(LOCALE_COOKIE)?.value);

  const authorizationUrl = client.buildAuthorizationUrl(config, {
    redirect_uri: redirectUri(),
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    ui_locales: locale,
  });

  const response = NextResponse.redirect(authorizationUrl);
  writeFlowCookie(response.cookies, { verifier, state, callbackUrl });
  // The welcome animation's layers, fetched while the person is away at Keycloak.
  response.headers.set('Link', preloadLayersHeader());
  return response;
}
