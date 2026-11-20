import NextAuth, { type DefaultSession } from 'next-auth';
import Keycloak from 'next-auth/providers/keycloak';
import { toLocale, type Locale } from '@cpeople/shared';
import { getAuthEnv } from './lib/auth-env';

declare module 'next-auth' {
  interface Session {
    user: {
      roles: string[];
      tenantId?: string;
      organization?: string;
      locale: Locale;
    } & DefaultSession['user'];
    /** Keycloak access token, passed on to the API as a bearer token. */
    accessToken?: string;
    /** Needed to end the Keycloak session as well as this one when signing out. */
    idToken?: string;
  }
}

/** The bits of the Keycloak token the UI needs; the API re-verifies everything. */
interface KeycloakClaims {
  realm_access?: { roles?: string[] };
  organization?: unknown;
  locale?: string;
  name?: string;
  email?: string;
}

function decodeClaims(token: string): KeycloakClaims {
  const part = token.split('.')[1];
  if (!part) return {};
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString()) as KeycloakClaims;
  } catch {
    return {};
  }
}

/**
 * The tenant, for display only.
 *
 * The API takes the tenant from the token it verifies itself and ignores anything
 * the browser says, so a wrong guess here shows the wrong label and nothing more
 * (M02 / HR-08).
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

const authEnv = getAuthEnv();

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Keycloak({
      issuer: authEnv.issuer,
      clientId: authEnv.clientId,
      // A public client: there is no secret to keep in a browser app, so the
      // authorization code is bound to this session with PKCE instead.
      client: { token_endpoint_auth_method: 'none' },
      checks: ['pkce', 'state'],
      authorization: {
        params: { scope: 'openid profile email organization' },
      },
    }),
  ],
  secret: authEnv.secret,
  // Local development serves http://localhost:3000 over plain http.
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: {
    signOut: '/signed-out',
  },
  callbacks: {
    jwt({ token, account }) {
      if (account?.access_token) {
        const claims = decodeClaims(account.access_token);
        const organization = readOrganization(claims.organization);
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
        token.expiresAt = account.expires_at;
        token.roles = claims.realm_access?.roles ?? [];
        token.tenantId = organization.tenantId;
        token.organization = organization.alias;
        // Keycloak is where the person chose their language, so it wins over
        // whatever the app guessed before they signed in.
        token.locale = toLocale(claims.locale);
      }
      return token;
    },
    session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      session.idToken = token.idToken as string | undefined;
      session.user.roles = (token.roles as string[] | undefined) ?? [];
      session.user.tenantId = token.tenantId as string | undefined;
      session.user.organization = token.organization as string | undefined;
      session.user.locale = toLocale(token.locale as string | undefined);
      return session;
    },
  },
});
