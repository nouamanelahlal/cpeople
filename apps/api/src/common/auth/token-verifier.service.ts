import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { AppConfigService } from '../config/app-config.js';
import {
  OrganizationClaimError,
  tenantFromOrganizationClaim,
  type TokenOrganization,
} from './organization-claim.js';

/** Who is making the request, as the token says — never as the request says. */
export interface Principal {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly roles: readonly string[];
  readonly locale?: string;
  readonly organization: TokenOrganization;
}

interface CPeopleClaims extends JWTPayload {
  email?: string;
  name?: string;
  preferred_username?: string;
  locale?: string;
  organization?: unknown;
  realm_access?: { roles?: string[] };
}

/**
 * Verifies Keycloak access tokens.
 *
 * Signature, issuer, audience and expiry are all checked against the realm's
 * published keys; nothing is taken on trust from the request itself.
 */
@Injectable()
export class TokenVerifierService {
  readonly #jwks: ReturnType<typeof createRemoteJWKSet>;
  readonly #issuer: string;
  readonly #audience: string;

  constructor(config: AppConfigService) {
    this.#issuer = config.keycloakIssuer;
    this.#audience = config.keycloakAudience;
    // Keys are fetched once and cached, then refreshed when the realm rotates them.
    this.#jwks = createRemoteJWKSet(new URL(`${this.#issuer}/protocol/openid-connect/certs`));
  }

  async verify(token: string): Promise<Principal> {
    let claims: CPeopleClaims;
    try {
      const { payload } = await jwtVerify<CPeopleClaims>(token, this.#jwks, {
        issuer: this.#issuer,
        audience: this.#audience,
      });
      claims = payload;
    } catch (error) {
      // The reason stays in the log; the caller is told only that it failed.
      throw new UnauthorizedException('The access token could not be verified', {
        cause: error,
      });
    }

    let organization: TokenOrganization;
    try {
      organization = tenantFromOrganizationClaim(claims.organization);
    } catch (error) {
      if (error instanceof OrganizationClaimError) {
        throw new UnauthorizedException(error.message, { cause: error });
      }
      throw error;
    }

    if (!claims.sub) {
      throw new UnauthorizedException('The access token has no subject');
    }

    return {
      userId: claims.sub,
      email: claims.email ?? claims.preferred_username ?? '',
      name: claims.name ?? claims.preferred_username ?? '',
      roles: claims.realm_access?.roles ?? [],
      ...(claims.locale === undefined ? {} : { locale: claims.locale }),
      organization,
    };
  }
}
