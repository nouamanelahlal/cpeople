import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { AppConfigService, loadAppConfig } from '../src/common/config/app-config.js';
import type { TokenVerifierService } from '../src/common/auth/token-verifier.service.js';
import { TenantContextService } from '../src/common/tenant/tenant-context.service.js';
import { TENANT_HEADER, TenantMiddleware } from '../src/common/tenant/tenant.middleware.js';

const TENANT_ID = '01a1f5a7-be9e-7368-b654-0a965c1d4412';

function requestWith(tenantHeader?: string): Request {
  return {
    header: (name: string) => (name.toLowerCase() === 'authorization' ? undefined : tenantHeader),
  } as unknown as Request;
}

const response = {} as Response;

const KEYCLOAK = {
  keycloakIssuer: 'https://id.cpeople.ma/realms/cpeople',
  keycloakAudience: 'cpeople-api',
};

/** A local checkout with the header switched on, which is the only case that allows it. */
function localDevConfig(): AppConfigService {
  return new AppConfigService({
    localDev: true,
    tenantHeaderAllowed: true,
    port: 3100,
    ...KEYCLOAK,
  });
}

/** Any deployed environment: Dev, Test and Prod all look like this. */
function deployedConfig(): AppConfigService {
  return new AppConfigService({
    localDev: false,
    tenantHeaderAllowed: false,
    port: 3100,
    ...KEYCLOAK,
  });
}

/** Stands in for the verifier; these cases never present a token. */
const noTokens = {
  verify: () => {
    throw new Error('not expected to be called');
  },
} as unknown as TokenVerifierService;

describe('M21 tenant context of a request', () => {
  it('makes the tenant available to the handlers downstream', () => {
    const context = new TenantContextService();
    const middleware = new TenantMiddleware(context, localDevConfig(), noTokens);
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
    const middleware = new TenantMiddleware(new TenantContextService(), localDevConfig(), noTokens);
    const next = vi.fn();

    expect(() => middleware.use(requestWith(undefined), response, next)).toThrow(
      new RegExp(TENANT_HEADER),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('refuses a tenant that is not a UUID', () => {
    const middleware = new TenantMiddleware(new TenantContextService(), localDevConfig(), noTokens);
    const next = vi.fn();

    expect(() => middleware.use(requestWith('smg; DROP TABLE tenant'), response, next)).toThrow();
    expect(next).not.toHaveBeenCalled();
  });

  it('ignores the header in a deployed environment, however valid it looks', () => {
    const context = new TenantContextService();
    const middleware = new TenantMiddleware(context, deployedConfig(), noTokens);
    const next = vi.fn();

    expect(() => middleware.use(requestWith(TENANT_ID), response, next)).toThrow(
      /local development only/i,
    );
    expect(next).not.toHaveBeenCalled();
    expect(context.current).toBeUndefined();
  });

  it('fails loudly when a service is used with no tenant context at all', () => {
    const context = new TenantContextService();

    expect(() => context.requireTenantId()).toThrow(/No tenant context/);
  });
});

describe('M21 configuration fails closed', () => {
  const deployed = {
    DATABASE_URL: 'postgresql://user:pw@db.internal:5432/cpeople',
    KEYCLOAK_ISSUER: 'https://id.cpeople.ma/realms/cpeople',
  };

  it('does not allow the tenant header in a deployed environment', () => {
    // Dev, Test and Prod all reach here: none of them sets CPEOPLE_LOCAL_DEV.
    expect(() => loadAppConfig({ ...deployed, TENANT_HEADER_ALLOWED: 'true' })).toThrow(
      /outside local development/i,
    );
  });

  it('does not allow the tenant header just because NODE_ENV is not production', () => {
    expect(() =>
      loadAppConfig({ ...deployed, NODE_ENV: 'development', TENANT_HEADER_ALLOWED: 'true' }),
    ).toThrow(/outside local development/i);
  });

  it('keeps the header off when nothing switches it on', () => {
    expect(loadAppConfig(deployed).tenantHeaderAllowed).toBe(false);
    expect(loadAppConfig({ CPEOPLE_LOCAL_DEV: 'true' }).tenantHeaderAllowed).toBe(false);
  });

  it('allows the header only in a local checkout that asks for it', () => {
    const config = loadAppConfig({ CPEOPLE_LOCAL_DEV: 'true', TENANT_HEADER_ALLOWED: 'true' });

    expect(config).toMatchObject({ localDev: true, tenantHeaderAllowed: true });
  });

  it('refuses to start in a deployed environment with no DATABASE_URL', () => {
    expect(() => loadAppConfig({})).toThrow(/DATABASE_URL is not set/);
    expect(() => loadAppConfig({ DATABASE_URL: '   ' })).toThrow(/DATABASE_URL is not set/);
  });

  it('does not need DATABASE_URL in a local checkout', () => {
    expect(() => loadAppConfig({ CPEOPLE_LOCAL_DEV: 'true' })).not.toThrow();
  });

  it('refuses a port that is not a positive integer', () => {
    expect(() => loadAppConfig({ ...deployed, API_PORT: 'eighty' })).toThrow(/API_PORT/);
  });
});
