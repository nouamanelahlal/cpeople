import { NextResponse, type NextRequest } from 'next/server';
import * as client from 'openid-client';
import { toLocale } from '@cpeople/shared';
import { clearFlowCookie, FLOW_COOKIE, readFlowCookie } from '../../../../lib/flow-cookie';
import { LOCALE_COOKIE } from '../../../../lib/locale';
import { oidcConfig, redirectUri, sessionFromTokens } from '../../../../lib/oidc';
import { sealSession, writeSessionCookies } from '../../../../lib/session';
import { WELCOME_COOKIE, WELCOME_MAX_AGE_SECONDS } from '../../../../lib/welcome';

/** Where Keycloak sends the browser back with an authorization code. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const flow = readFlowCookie(request.cookies.get(FLOW_COOKIE)?.value);

  if (!flow) {
    // No flow cookie: a stale tab, a bookmarked callback, or a cross-site attempt.
    return NextResponse.redirect(new URL('/', request.nextUrl.origin));
  }

  const config = await oidcConfig();

  let session;
  try {
    const currentUrl = new URL(request.url);
    currentUrl.protocol = new URL(redirectUri()).protocol;
    const tokens = await client.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: flow.verifier,
      expectedState: flow.state,
    });
    session = sessionFromTokens(tokens, toLocale(request.cookies.get(LOCALE_COOKIE)?.value));
  } catch (error) {
    console.error('sign-in callback failed', error);
    const failed = NextResponse.redirect(new URL('/?error=sign-in', request.nextUrl.origin));
    clearFlowCookie(failed.cookies);
    return failed;
  }

  const response = NextResponse.redirect(new URL(flow.callbackUrl, request.nextUrl.origin));
  writeSessionCookies(response.cookies, await sealSession(session));
  clearFlowCookie(response.cookies);
  // Keep the public pages in the language Keycloak ended up using.
  response.cookies.set(LOCALE_COOKIE, session.locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  // "This person has just signed in", for the welcome animation. The page that
  // plays it deletes this on sight, so a refresh does not play it again.
  response.cookies.set(WELCOME_COOKIE, '1', {
    path: '/',
    maxAge: WELCOME_MAX_AGE_SECONDS,
    sameSite: 'lax',
  });
  return response;
}
