import { NextResponse, type NextRequest } from 'next/server';
import { accessTokenExpired, openSession, readSealedSession } from './lib/session';
import { PATH_HEADER } from './lib/request-path';

/**
 * Everything is signed-in by default; the exceptions are listed here (M02 / HR-08).
 * A new page is therefore protected unless someone deliberately opens it up.
 */
const PUBLIC_PATHS = ['/', '/signed-out'];

/**
 * The request-time gate. It only opens the session cookie — no network, no realm
 * discovery — so it stays cheap and works in the edge runtime; anything that has to
 * talk to Keycloak happens in the route handlers under /api/auth.
 */
export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const session = await openSession(readSealedSession(request.cookies));

  if (!session) {
    const signIn = new URL('/api/auth/sign-in', request.nextUrl.origin);
    signIn.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signIn);
  }

  if (accessTokenExpired(session)) {
    return NextResponse.redirect(refreshUrl(request.nextUrl.origin, pathname));
  }

  // The page the request is for, for a server component that needs to send the
  // reader somewhere and come back (lib/api.ts does, when the API refuses a token
  // this gate thought was still good). Nothing else should read it: a page knows
  // what it is.
  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, pathname);
  return NextResponse.next({ request: { headers } });
}

/** Where a request goes to have its access token renewed, and then come back. */
export function refreshUrl(origin: string, pathname: string): URL {
  const refresh = new URL('/api/auth/refresh', origin);
  refresh.searchParams.set('callbackUrl', pathname);
  return refresh;
}

export const config = {
  // Everything but Next's own assets and the sign-in routes themselves.
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|brand|site.webmanifest).*)',
  ],
};
