/**
 * Sign-in settings, read and checked the first time they are needed.
 *
 * The same build moves Dev → Test → Prod and is never rebuilt in between (CLAUDE.md,
 * Environments), so these are read when the server starts in an environment, never
 * baked into the bundle. Producing the bundle therefore does not need them — but
 * running does, and a deployed environment that is missing one fails loudly rather
 * than signing people in against the wrong realm.
 */

const LOCAL_DEV_ISSUER = 'http://localhost:8080/realms/cpeople';

/**
 * Only ever used when CPEOPLE_LOCAL_DEV is set, which the repository's own scripts
 * do and no deployment does. Auth.js encrypts the session cookie with it; locally
 * that cookie protects nothing but fake data.
 */
const LOCAL_DEV_SECRET = 'cpeople-local-development-secret-not-for-deployment';

export interface AuthEnv {
  readonly localDev: boolean;
  readonly issuer: string;
  readonly clientId: string;
  readonly secret: string;
  /** Where the browser reaches the API. */
  readonly apiBaseUrl: string;
  /** This app's own origin, for the post-logout return trip. */
  readonly appUrl: string;
}

let cached: AuthEnv | undefined;

/**
 * `next build` evaluates server modules to collect page data, with none of the
 * environment's settings present. Requiring them there would mean the bundle could
 * only be built where it is run, which is exactly what the one-build rule forbids.
 */
function isBuilding(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

function required(name: string, localDev: boolean, localFallback: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (localDev || isBuilding()) return localFallback;
  throw new Error(
    `${name} is not set. Every deployed environment must configure sign-in; ` +
      'only a local checkout falls back to the Docker stack.',
  );
}

export function getAuthEnv(): AuthEnv {
  if (cached) return cached;

  const localDev = process.env.CPEOPLE_LOCAL_DEV === 'true';
  const issuer = required('KEYCLOAK_ISSUER', localDev, LOCAL_DEV_ISSUER).replace(/\/$/, '');

  if (!localDev && !isBuilding() && !issuer.startsWith('https://')) {
    // Tokens and the keys that verify them must not travel in the clear.
    throw new Error(
      `KEYCLOAK_ISSUER must be an https URL outside local development, got "${issuer}".`,
    );
  }

  cached = {
    localDev,
    issuer,
    clientId: process.env.KEYCLOAK_CLIENT_ID?.trim() || 'cpeople-web',
    secret: required('AUTH_SECRET', localDev, LOCAL_DEV_SECRET),
    apiBaseUrl: process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:3100',
    appUrl: (process.env.AUTH_URL?.trim() || 'http://localhost:3000').replace(/\/$/, ''),
  };

  return cached;
}
