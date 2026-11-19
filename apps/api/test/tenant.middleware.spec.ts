import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { TenantContextService } from '../src/common/tenant/tenant-context.service.js';
import { TENANT_HEADER, TenantMiddleware } from '../src/common/tenant/tenant.middleware.js';

const TENANT_ID = '01a1f5a7-be9e-7368-b654-0a965c1d4412';

function requestWith(header?: string): Request {
  return { header: () => header } as unknown as Request;
}

const response = {} as Response;

describe('M21 tenant context of a request', () => {
  it('makes the tenant available to the handlers downstream', () => {
    const context = new TenantContextService();
    const middleware = new TenantMiddleware(context);
    const seen: string[] = [];
    const next: NextFunction = () => {
      seen.push(context.requireTenantId());
    };

    middleware.use(requestWith(TENANT_ID), response, next);

    expect(seen).toEqual([TENANT_ID]);
    // The context does not leak outside the request.
    expect(context.current).toBeUndefined();
  });

  it('refuses a request without a tenant', () => {
    const middleware = new TenantMiddleware(new TenantContextService());
    const next = vi.fn();

    expect(() => middleware.use(requestWith(undefined), response, next)).toThrow(
      new RegExp(TENANT_HEADER),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('refuses a tenant that is not a UUID', () => {
    const middleware = new TenantMiddleware(new TenantContextService());
    const next = vi.fn();

    expect(() => middleware.use(requestWith('smg; DROP TABLE tenant'), response, next)).toThrow();
    expect(next).not.toHaveBeenCalled();
  });

  it('does not trust the header in production', () => {
    const middleware = new TenantMiddleware(new TenantContextService());
    const next = vi.fn();
    vi.stubEnv('NODE_ENV', 'production');

    try {
      expect(() => middleware.use(requestWith(TENANT_ID), response, next)).toThrow(
        /not implemented/i,
      );
      expect(next).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('fails loudly when a service is used with no tenant context at all', () => {
    const context = new TenantContextService();

    expect(() => context.requireTenantId()).toThrow(/No tenant context/);
  });
});
