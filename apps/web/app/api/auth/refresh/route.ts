import { NextResponse, type NextRequest } from 'next/server';
import * as client from 'openid-client';
import { safeCallbackUrl } from '../../../../lib/flow-cookie';
import { oidcConfig, sessionFromTokens } from '../../../../lib/oidc';
import {
  clearSessionCookies,
  openSession,
  readSealedSession,
  sealSession,
  writeSessionCookies,
} from '../../../../lib/session';

/**
 * Trades the refresh token for a new access token and re-seals the session.
 *
 * The gate sends people here when their access token has run out, so a working day
 * does not end with being bounced to the sign-in page every five minutes. If the
 * refresh fails — revoked, or the Keycloak session itself has ended — the session
 * is cleared and sign-in starts again.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const callbackUrl = safeCallbackUrl(request.nextUrl.searchParams.get('callbackUrl'), '/home');
  const session = await openSession(readSealedSession(request.cookies));

  const signIn = new URL('/api/auth/sign-in', request.nextUrl.origin);
  signIn.searchParams.set('callbackUrl', callbackUrl);

  if (!session?.refreshToken) {
    const response = NextResponse.redirect(signIn);
    clearSessionCookies(response.cookies);
    return response;
  }

  try {
    const tokens = await client.refreshTokenGrant(await oidcConfig(), session.refreshToken);
    const refreshed = sessionFromTokens(tokens, session.locale);
    const response = NextResponse.redirect(new URL(callbackUrl, request.nextUrl.origin));
    writeSessionCookies(response.cookies, await sealSession(refreshed));
    return response;
  } catch (error) {
    console.error('token refresh failed', error);
    const response = NextResponse.redirect(signIn);
    clearSessionCookies(response.cookies);
    return response;
  }
}
