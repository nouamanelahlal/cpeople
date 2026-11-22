import { headers } from 'next/headers';

/**
 * Where the current request is for: the path and its query string.
 *
 * Next gives a server component no way to ask, so the gate in proxy.ts puts it on
 * the request. Two things need it, and both are "send the reader away and bring
 * them back here": renewing an access token the API has refused, and changing
 * language, which re-renders the page they were actually reading.
 */
export const PATH_HEADER = 'x-cpeople-path';

export async function requestPath(fallback = '/home'): Promise<string> {
  const value = (await headers()).get(PATH_HEADER);
  // Ours, from the gate, and never from the client: a path that did not come
  // through the gate is not one to redirect to.
  return value !== null && value.startsWith('/') && !value.startsWith('//') ? value : fallback;
}
