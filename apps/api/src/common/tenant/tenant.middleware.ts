import { BadRequestException, Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TokenVerifierService } from '../auth/token-verifier.service.js';
import { AppConfigService } from '../config/app-config.js';
import { TenantContextService } from './tenant-context.service.js';

export const TENANT_HEADER = 'x-tenant-id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BEARER = /^Bearer (.+)$/i;

/**
 * Establishes who is calling and which tenant they are in, for the rest of the
 * request (M02 / HR-08).
 *
 * The tenant comes from the organisation claim of a verified Keycloak token and
 * from nowhere else. The `x-tenant-id` header is a leftover from before sign-in
 * existed: it names a tenant with no user behind it, so it is honoured only in a
 * local checkout that explicitly asks for it, and the API refuses to start if a
 * deployed environment tries to switch it on.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly config: AppConfigService,
    private readonly tokens: TokenVerifierService,
  ) {}

  use(request: Request, _response: Response, next: NextFunction): void {
    const bearer = BEARER.exec(request.header('authorization') ?? '');

    if (bearer?.[1]) {
      void this.#withVerifiedToken(bearer[1], next);
      return;
    }

    if (!this.config.tenantHeaderAllowed) {
      throw new UnauthorizedException(
        'This request carries no access token. Sign in to CPeople; the ' +
          `${TENANT_HEADER} header is accepted in local development only.`,
      );
    }

    const header = request.header(TENANT_HEADER);
    if (!header || !UUID.test(header)) {
      throw new BadRequestException(`${TENANT_HEADER} must be a tenant UUID`);
    }

    this.tenantContext.run({ tenantId: header }, () => {
      next();
    });
  }

  async #withVerifiedToken(token: string, next: NextFunction): Promise<void> {
    let principal;
    try {
      principal = await this.tokens.verify(token);
    } catch (error) {
      // Express needs the failure handed to next(), since this ran after use() returned.
      next(error);
      return;
    }

    this.tenantContext.run({ tenantId: principal.organization.tenantId, principal }, () => {
      next();
    });
  }
}
