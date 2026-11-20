import { NextResponse, type NextRequest } from 'next/server';
import { accessTokenExpired, openSession, readSealedSession } from './lib/session';

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
    const refresh = new URL('/api/auth/refresh', request.nextUrl.origin);
    refresh.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(refresh);
  }

  return NextResponse.next();
}

export const config = {
  // Everything but Next's own assets and the sign-in routes themselves.
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|brand|site.webmanifest).*)',
  ],
};
