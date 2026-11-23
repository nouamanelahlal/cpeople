/**
 * The welcome animation plays once, right after a sign-in (NEW / M02).
 *
 * The callback route sets this cookie when it has just exchanged a code for a
 * session; the home screen reads it, plays the animation, and the browser deletes
 * it immediately. Nothing else sets it — not a refresh, not a token refresh, not a
 * session that was already there — so arriving at the home screen any other way is
 * silent.
 *
 * It is deliberately not httpOnly: the page that consumes it is the one that has to
 * clear it, and the only thing it says is "you have just signed in".
 */
export const WELCOME_COOKIE = 'cpeople_welcome';

/**
 * Short-lived, so a browser that never runs the script (and so never clears it)
 * cannot carry it into some later visit.
 */
export const WELCOME_MAX_AGE_SECONDS = 120;

/**
 * The layers the animation draws, in the order it needs them.
 *
 * They are preloaded when sign-in starts — the person is away at Keycloak typing a
 * password, which is the one moment in the flow with time to spare — so the first
 * frame does not wait for a download. Plain paths, not optimised ones, so the URL
 * that is preloaded is exactly the URL the animation asks for.
 */
export const WELCOME_LAYERS = [
  '/brand/welcome/layer-tile.png',
  '/brand/welcome/layer-c.png',
  '/brand/welcome/layer-person-left.png',
  '/brand/welcome/layer-person-middle.png',
  '/brand/welcome/layer-person-right.png',
  '/brand/welcome/icon-final-512.png',
] as const;

export const WELCOME_WORDMARK = '/brand/cpeople-wordmark-transparent.png';

/** A `Link` header that asks the browser to fetch the layers while it redirects. */
export function preloadLayersHeader(): string {
  return [...WELCOME_LAYERS, WELCOME_WORDMARK]
    .map((path) => `<${path}>; rel=preload; as=image`)
    .join(', ');
}
