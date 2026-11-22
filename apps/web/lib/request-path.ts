import { headers } from 'next/headers';

/**
 * The path the current request is for.
 *
 * Next gives a server component no way to ask, so the gate in proxy.ts puts it on
 * the request. It is needed in one place: when the API refuses the access token
 * the gate let through, the page sends the reader off to have it renewed and back
 * to where they were.
 */
export const PATH_HEADER = 'x-cpeople-path';

export async function requestPath(fallback = '/home'): Promise<string> {
  const value = (await headers()).get(PATH_HEADER);
  // Ours, from the gate, and never from the client: a path that did not come
  // through the gate is not one to redirect to.
  return value !== null && value.startsWith('/') && !value.startsWith('//') ? value : fallback;
}
