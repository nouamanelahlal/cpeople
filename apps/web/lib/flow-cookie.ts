import type { ResponseCookies } from 'next/dist/compiled/@edge-runtime/cookies';
import { getAuthEnv } from './auth-env';

/**
 * The short-lived state of one sign-in attempt: the PKCE verifier that binds the
 * authorization code to this browser, the state value that proves the response
 * belongs to this request, and where to go afterwards.
 */
export const FLOW_COOKIE = 'cpeople_signin';

/** Long enough to read the Keycloak pages and type a code, short enough to be safe. */
const FLOW_MAX_AGE_SECONDS = 15 * 60;

export interface SignInFlow {
  verifier: string;
  state: string;
  callbackUrl: string;
}

export function writeFlowCookie(cookies: ResponseCookies, flow: SignInFlow): void {
  cookies.set(FLOW_COOKIE, JSON.stringify(flow), {
    httpOnly: true,
    // Lax, not strict: the browser arrives back here from Keycloak by following a
    // redirect, and a strict cookie would not be sent on that navigation.
    sameSite: 'lax',
    secure: !getAuthEnv().localDev,
    path: '/',
    maxAge: FLOW_MAX_AGE_SECONDS,
  });
}

export function clearFlowCookie(cookies: ResponseCookies): void {
  cookies.set(FLOW_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: !getAuthEnv().localDev,
    path: '/',
    maxAge: 0,
  });
}

export function readFlowCookie(value: string | undefined): SignInFlow | null {
  if (!value) return null;
  try {
    const flow = JSON.parse(value) as SignInFlow;
    return flow.verifier && flow.state ? flow : null;
  } catch {
    return null;
  }
}

/**
 * Only ever send people to a path on this site.
 *
 * Without this, `?callbackUrl=https://elsewhere.example` would turn sign-in into an
 * open redirect.
 */
export function safeCallbackUrl(raw: string | null | undefined, fallback = '/home'): string {
  if (!raw) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw;
}
