import { redirect } from 'next/navigation';
import { getSession } from './auth';
import { requestPath } from './request-path';
import { accessTokenExpired } from './session';

/**
 * How the web app talks to the API (HR-01 / M02).
 *
 * Always from the server, never from the browser, and always with the signed-in
 * person's access token: the API decides what they may see, and it has to be
 * asked as them. That is also why nothing here takes a tenant — the token
 * carries it, and the API reads it from nowhere else.
 */
const API_URL = process.env.CPEOPLE_API_URL ?? 'http://localhost:3100/api';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message: string,
  ) {
    super(`${path} answered ${status}: ${message}`);
    this.name = 'ApiError';
  }
}

/**
 * Asks the API for something, as the person reading the page.
 *
 * Reads are never cached: an employee file that is one request out of date is
 * worse than one that took a moment longer.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const session = await getSession();
  if (!session) {
    throw new ApiError(401, path, 'nobody is signed in');
  }

  const ask = async (): Promise<T> => {
    const response = await fetch(`${API_URL}${path}`, {
      headers: { authorization: `Bearer ${session.accessToken}`, accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new ApiError(response.status, path, await response.text().catch(() => ''));
    }

    return (await response.json()) as T;
  };

  try {
    return await ask();
  } catch (error) {
    if (!worthRetrying(error)) {
      throw error;
    }

    // Once more, a moment later. A read that is refused for a reason that may
    // pass — the API still starting, a connection that did not open, a token
    // that could not be checked because the key set was momentarily out of
    // reach — should not turn into a screen full of dashes on the strength of
    // one attempt. A real refusal refuses twice.
    await new Promise((resume) => setTimeout(resume, 250));
    return await ask();
  }
}

/** Whether a failed read is the kind that is worth asking a second time. */
function worthRetrying(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    // Never reached the API at all: it was starting, or the connection dropped.
    return true;
  }

  return error.status === 401 || error.status >= 500;
}

/**
 * The same, for a page that would rather draw something than nothing.
 *
 * The HR-01 screens are read-only summaries: if the API is unreachable, the
 * page still arrives and says what is missing, rather than failing whole.
 *
 * One refusal is worth acting on rather than drawing around. The gate renews an
 * access token before a page renders, but a token can still be refused — it ran
 * out in the moment between, or Keycloak was restarted under it — and a dashboard
 * full of dashes is not the right answer to that. The reader is sent to have the
 * token renewed and brought back to the page they asked for, exactly as the gate
 * would have done. Only for a token that really has run out, so a misconfigured
 * API cannot turn this into a loop.
 */
export async function apiGetOrNull<T>(path: string): Promise<T | null> {
  try {
    return await apiGet<T>(path);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && (await tokenRanOut())) {
      const back = await requestPath();
      redirect(`/api/auth/refresh?callbackUrl=${encodeURIComponent(back)}`);
    }

    console.error('API request failed', error);
    return null;
  }
}

/** Whether the session we just asked with is past its access token's expiry. */
async function tokenRanOut(): Promise<boolean> {
  const session = await getSession();
  return session === null || accessTokenExpired(session, 0);
}
