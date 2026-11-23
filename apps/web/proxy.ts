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

  // Where they were going, query string and all: a filtered list, a tab of a
  // file. Sending them back to the bare path after a detour through sign-in or a
  // token renewal would quietly undo what they had asked for.
  const asked = `${pathname}${request.nextUrl.search}`;

  if (!session) {
    const signIn = new URL('/api/auth/sign-in', request.nextUrl.origin);
    signIn.searchParams.set('callbackUrl', asked);
    return NextResponse.redirect(signIn);
  }

  if (accessTokenExpired(session)) {
    return NextResponse.redirect(refreshUrl(request.nextUrl.origin, asked));
  }

  // The same, handed to the page: a server component that has to send the reader
  // away and bring them back needs to know where back is — the token refresh when
  // the API refuses one (lib/api.ts), and the language toggle, which comes back
  // to the page being read rather than to the home screen.
  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, asked);
  return NextResponse.next({ request: { headers } });
}

/** Where a request goes to have its access token renewed, and then come back. */
export function refreshUrl(origin: string, callbackUrl: string): URL {
  const refresh = new URL('/api/auth/refresh', origin);
  refresh.searchParams.set('callbackUrl', callbackUrl);
  return refresh;
}

export const config = {
  // Everything but Next's own assets and the sign-in routes themselves.
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|brand|site.webmanifest).*)',
  ],
};
