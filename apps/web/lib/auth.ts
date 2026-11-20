import { cookies } from 'next/headers';
import { openSession, readSealedSession, type Session } from './session';

/**
 * The signed-in session for a server component.
 *
 * Reading only: a page cannot set cookies, so refreshing the token is the gate's
 * job (see proxy.ts), which redirects through /api/auth/refresh before the page
 * ever renders.
 */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return openSession(readSealedSession(store));
}
