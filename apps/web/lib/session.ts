import { EncryptJWT, jwtDecrypt } from 'jose';
import type { ResponseCookies } from 'next/dist/compiled/@edge-runtime/cookies';
import { toLocale, type Locale } from '@cpeople/shared';
import { getAuthEnv } from './auth-env';

/**
 * The signed-in session, kept in an encrypted httpOnly cookie.
 *
 * The browser can neither read nor forge it: it is a JWE sealed with a key derived
 * from SESSION_SECRET, and the cookie is httpOnly, so no script on the page can
 * reach the tokens inside. The API never trusts any of this anyway — it re-verifies
 * the access token against the realm's keys on every request (M02 / HR-08).
 */
export interface Session {
  readonly sub: string;
  readonly name: string;
  readonly email: string;
  readonly roles: readonly string[];
  /** For display only; the API takes the tenant from the token it verifies. */
  readonly tenantId?: string;
  readonly organization?: string;
  readonly locale: Locale;
  readonly accessToken: string;
  readonly refreshToken?: string;
  /** Needed to end the Keycloak session, not only this one, when signing out. */
  readonly idToken?: string;
  /** Epoch seconds. */
  readonly accessTokenExpiresAt: number;
}

export const SESSION_COOKIE = 'cpeople_session';

/**
 * Browsers cap a cookie at about 4 KB and a Keycloak session carries three tokens,
 * so the sealed value is split across numbered cookies and put back together on the
 * way in.
 */
const CHUNK_SIZE = 3000;
const MAX_CHUNKS = 8;

/** How long a session may live before the person signs in again. */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 10;

async function key(): Promise<CryptoKey> {
  const secret = new TextEncoder().encode(getAuthEnv().sessionSecret);
  const digest = await crypto.subtle.digest('SHA-256', secret);
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function sealSession(session: Session): Promise<string> {
  return new EncryptJWT({ ...session })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .encrypt(await key());
}

export async function openSession(sealed: string | undefined): Promise<Session | null> {
  if (!sealed) return null;
  try {
    const { payload } = await jwtDecrypt(sealed, await key());
    const session = payload as unknown as Session;
    if (!session.sub || !session.accessToken) return null;
    return { ...session, locale: toLocale(session.locale) };
  } catch {
    // A session that cannot be opened — wrong key, tampered with, expired — is no
    // session at all. The caller sends the person to sign in again.
    return null;
  }
}

/** Reassembles the sealed session from however many cookies it took. */
export function readSealedSession(cookies: {
  get(name: string): { value: string } | undefined;
}): string | undefined {
  const first = cookies.get(SESSION_COOKIE)?.value;
  if (first === undefined) return undefined;

  let sealed = first;
  for (let index = 1; index < MAX_CHUNKS; index += 1) {
    const next = cookies.get(`${SESSION_COOKIE}.${index}`)?.value;
    if (next === undefined) break;
    sealed += next;
  }
  return sealed;
}

function cookieOptions() {
  const { localDev } = getAuthEnv();
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    // Local development serves plain http; everywhere else this cookie is the
    // session, so it must never leave over an unencrypted connection.
    secure: !localDev,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function writeSessionCookies(cookies: ResponseCookies, sealed: string): void {
  const options = cookieOptions();
  const chunks: string[] = [];
  for (let offset = 0; offset < sealed.length; offset += CHUNK_SIZE) {
    chunks.push(sealed.slice(offset, offset + CHUNK_SIZE));
  }

  if (chunks.length > MAX_CHUNKS) {
    throw new Error(`The session is too large for ${MAX_CHUNKS} cookies.`);
  }

  chunks.forEach((chunk, index) => {
    cookies.set(index === 0 ? SESSION_COOKIE : `${SESSION_COOKIE}.${index}`, chunk, options);
  });

  // Clear any chunk left over from a longer session.
  for (let index = chunks.length; index < MAX_CHUNKS; index += 1) {
    const name = index === 0 ? SESSION_COOKIE : `${SESSION_COOKIE}.${index}`;
    cookies.set(name, '', { ...options, maxAge: 0 });
  }
}

export function clearSessionCookies(cookies: ResponseCookies): void {
  const options = { ...cookieOptions(), maxAge: 0 };
  cookies.set(SESSION_COOKIE, '', options);
  for (let index = 1; index < MAX_CHUNKS; index += 1) {
    cookies.set(`${SESSION_COOKIE}.${index}`, '', options);
  }
}

/** True when the access token has run out, or is about to. */
export function accessTokenExpired(session: Session, skewSeconds = 60): boolean {
  return session.accessTokenExpiresAt - skewSeconds <= Math.floor(Date.now() / 1000);
}
