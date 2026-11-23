import * as client from 'openid-client';
import { toLocale, type Locale } from '@cpeople/shared';
import { getAuthEnv } from './auth-env';
import type { Session } from './session';

/**
 * The OpenID Connect client for the CPeople realm.
 *
 * Authorization code flow with PKCE. The realm declares cpeople-web as a public
 * client, because a browser app has nowhere to keep a secret; where an environment
 * makes it confidential instead, the secret comes from KEYCLOAK_CLIENT_SECRET and
 * never from this repository.
 */
let discovered: Promise<client.Configuration> | undefined;

export function oidcConfig(): Promise<client.Configuration> {
  if (discovered) return discovered;

  const { issuer, clientId, clientSecret, localDev } = getAuthEnv();

  discovered = client
    .discovery(
      new URL(issuer),
      clientId,
      undefined,
      clientSecret ? client.ClientSecretPost(clientSecret) : client.None(),
      // The local realm is served over plain http on localhost; anywhere else the
      // issuer is required to be https, checked when the settings are read.
      localDev ? { execute: [client.allowInsecureRequests] } : undefined,
    )
    .catch((error: unknown) => {
      // Don't cache a failed discovery: the realm may just have been slow to start.
      discovered = undefined;
      throw error;
    });

  return discovered;
}

export function redirectUri(): string {
  return `${getAuthEnv().appUrl}/api/auth/callback`;
}

/** The scopes CPeople needs: `organization` is what carries the tenant. */
export const SCOPE = 'openid profile email organization';

interface AccessTokenClaims {
  sub?: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  locale?: string;
  realm_access?: { roles?: string[] };
  organization?: unknown;
  exp?: number;
}

function decodeClaims(token: string): AccessTokenClaims {
  const part = token.split('.')[1];
  if (!part) return {};
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString()) as AccessTokenClaims;
  } catch {
    return {};
  }
}

/**
 * The tenant, for display only.
 *
 * The API takes the tenant from the token it verifies itself and ignores anything
 * the browser says, so a wrong guess here shows the wrong label and nothing more.
 */
function readOrganization(claim: unknown): { alias?: string; tenantId?: string } {
  if (!Array.isArray(claim)) return {};
  for (const entry of claim) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      for (const [alias, details] of Object.entries(entry as Record<string, unknown>)) {
        const tenantId = (details as Record<string, unknown> | null)?.['tenantId'];
        const value = Array.isArray(tenantId) ? tenantId[0] : tenantId;
        return { alias, tenantId: typeof value === 'string' ? value : undefined };
      }
    }
  }
  return {};
}

/** Builds the session CPeople keeps from the tokens Keycloak returned. */
export function sessionFromTokens(
  tokens: client.TokenEndpointResponse,
  fallbackLocale: Locale,
): Session {
  const claims = decodeClaims(tokens.access_token);
  const organization = readOrganization(claims.organization);
  const expiresIn = tokens.expires_in ?? 300;

  return {
    sub: claims.sub ?? '',
    name: claims.name ?? claims.preferred_username ?? '',
    email: claims.email ?? claims.preferred_username ?? '',
    roles: claims.realm_access?.roles ?? [],
    ...(organization.tenantId === undefined ? {} : { tenantId: organization.tenantId }),
    ...(organization.alias === undefined ? {} : { organization: organization.alias }),
    // Keycloak is where the person chose their language, so it wins over whatever
    // the app guessed before they signed in.
    locale: claims.locale ? toLocale(claims.locale) : fallbackLocale,
    accessToken: tokens.access_token,
    ...(tokens.refresh_token === undefined ? {} : { refreshToken: tokens.refresh_token }),
    ...(tokens.id_token === undefined ? {} : { idToken: tokens.id_token }),
    accessTokenExpiresAt: Math.floor(Date.now() / 1000) + expiresIn,
  };
}
