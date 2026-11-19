import {
  BadRequestException,
  Injectable,
  NestMiddleware,
  NotImplementedException,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TenantContextService } from './tenant-context.service.js';

export const TENANT_HEADER = 'x-tenant-id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Puts the tenant of the request into the tenant context.
 *
 * TODO(M02 / HR-08): read the tenant from the verified Keycloak token. Until then a
 * request header carries it, which is accepted only outside production — a client
 * choosing its own tenant is exactly the hole the policies exist to close.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantContext: TenantContextService) {}

  use(request: Request, _response: Response, next: NextFunction): void {
    if (process.env.NODE_ENV === 'production') {
      throw new NotImplementedException(
        'Tenant resolution from the session token is not implemented yet (M02)',
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
