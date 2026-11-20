import { NextResponse } from 'next/server';
import { auth } from './auth';

/**
 * Everything is signed-in by default; the exceptions are listed here (M02 / HR-08).
 * A new page is therefore protected unless someone deliberately opens it up.
 */
const PUBLIC_PATHS = ['/', '/signed-out'];

// Next 16 calls this file "proxy"; it is the same request-time gate the
// "middleware" convention used to provide.
export default auth((request) => {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  if (!request.auth) {
    const signIn = new URL('/api/auth/signin', request.nextUrl.origin);
    signIn.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signIn);
  }

  return NextResponse.next();
});

export const config = {
  // Everything but Next's own assets and the sign-in routes themselves.
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|brand|site.webmanifest).*)'],
};
