import { BadRequestException, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AppConfigService } from '../config/app-config.js';
import { TenantContextService } from './tenant-context.service.js';

export const TENANT_HEADER = 'x-tenant-id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Puts the tenant of the request into the tenant context.
 *
 * TODO(M02 / HR-08): read the tenant from the verified Keycloak token. Until then a
 * request header carries it, and that is accepted only when TENANT_HEADER_ALLOWED
 * is explicitly on in a local checkout — a client choosing its own tenant is exactly
 * the hole the policies exist to close. Deployed environments (Dev, Test and Prod
 * alike) never set it, and the API refuses to start if they do.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly config: AppConfigService,
  ) {}

  use(request: Request, _response: Response, next: NextFunction): void {
    if (!this.config.tenantHeaderAllowed) {
      // 400, not 501: from the caller's side the request simply carries no usable
      // tenant. The reason it cannot is a server-side configuration decision.
      throw new BadRequestException(
        'No tenant for this request. Sign-in carries the tenant (M02); the ' +
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
}
