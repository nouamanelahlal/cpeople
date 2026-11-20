import { NextResponse, type NextRequest } from 'next/server';
import * as client from 'openid-client';
import { getAuthEnv } from '../../../../lib/auth-env';
import { oidcConfig } from '../../../../lib/oidc';
import { clearSessionCookies, openSession, readSealedSession } from '../../../../lib/session';

/**
 * Ends this session and the Keycloak one.
 *
 * Signing out of the app alone would leave the Keycloak session open, so the next
 * person at the same machine would be signed straight back in without a password.
 * The id token identifies the session being ended, which also means Keycloak does
 * not stop to ask "are you sure".
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await openSession(readSealedSession(request.cookies));
  const { appUrl, clientId } = getAuthEnv();

  let endSession: URL;
  try {
    endSession = client.buildEndSessionUrl(await oidcConfig(), {
      post_logout_redirect_uri: `${appUrl}/signed-out`,
      ...(session?.idToken ? { id_token_hint: session.idToken } : { client_id: clientId }),
    });
  } catch (error) {
    // Even if Keycloak cannot be reached, this session still ends here.
    console.error('could not build the end-session URL', error);
    endSession = new URL('/signed-out', request.nextUrl.origin);
  }

  const response = NextResponse.redirect(endSession, { status: 303 });
  clearSessionCookies(response.cookies);
  return response;
}
