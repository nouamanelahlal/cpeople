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

/** Nothing here touches storage or mail; they are named because the settings are one shape. */
const STORAGE = {
  gotenbergUrl: 'http://localhost:3001',
  mail: {
    host: 'localhost',
    port: 1025,
    from: 'CPeople <no-reply@cpeople.local>',
    appUrl: 'http://localhost:3000',
  },
  storage: {
    endpoint: 'http://localhost:9000',
    region: 'us-east-1',
    bucket: 'cpeople-test',
    accessKeyId: 'test',
    secretAccessKey: 'test',
    createBucket: false,
  },
};

/** A local checkout with the header switched on, which is the only case that allows it. */
function localDevConfig(): AppConfigService {
  return new AppConfigService({
    localDev: true,
    tenantHeaderAllowed: true,
    port: 3100,
    ...KEYCLOAK,
    ...STORAGE,
  });
}

/** Any deployed environment: Dev, Test and Prod all look like this. */
function deployedConfig(): AppConfigService {
  return new AppConfigService({
    localDev: false,
    tenantHeaderAllowed: false,
    port: 3100,
    ...KEYCLOAK,
    ...STORAGE,
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
    // A deployed environment names its own object store, and the API refuses to
    // start without one; employee documents have to go somewhere.
    S3_ENDPOINT: 'https://storage.cpeople.ma',
    S3_BUCKET: 'cpeople-prod',
    S3_ACCESS_KEY_ID: 'key',
    S3_SECRET_ACCESS_KEY: 'secret',
    GOTENBERG_URL: 'https://documents.cpeople.ma',
    // Notices about leave have to be able to leave the building: an approval
    // nobody was told about is a request still sitting in somebody's inbox.
    MAIL_HOST: 'smtp.cpeople.ma',
    MAIL_FROM: 'CPeople <no-reply@cpeople.ma>',
    APP_URL: 'https://app.cpeople.ma',
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

describe('HR-01 document storage is configured before the API starts', () => {
  const deployed = {
    DATABASE_URL: 'postgresql://user:pw@db.internal:5432/cpeople',
    KEYCLOAK_ISSUER: 'https://id.cpeople.ma/realms/cpeople',
  };

  it('refuses to start in a deployed environment with nowhere to render a PDF', () => {
    expect(() =>
      loadAppConfig({
        ...deployed,
        S3_ENDPOINT: 'https://s3.cpeople.ma',
        S3_BUCKET: 'cpeople-prod',
        S3_ACCESS_KEY_ID: 'key',
        S3_SECRET_ACCESS_KEY: 'secret',
      }),
    ).toThrow(/GOTENBERG_URL/);
  });

  it('refuses to start in a deployed environment with nowhere to put documents', () => {
    // Accepting an upload and losing it is worse than not starting.
    expect(() => loadAppConfig(deployed)).toThrow(/S3_ENDPOINT/);
    expect(() => loadAppConfig({ ...deployed, S3_ENDPOINT: 'https://s3.cpeople.ma' })).toThrow(
      /S3_BUCKET/,
    );
  });

  it('falls back to the local stack in a developer checkout, and makes its bucket', () => {
    const config = loadAppConfig({ CPEOPLE_LOCAL_DEV: 'true' });

    expect(config.storage.endpoint).toBe('http://localhost:9000');
    expect(config.storage.bucket).toBe('cpeople-local');
    expect(config.storage.createBucket).toBe(true);
  });

  it('never gives a deployed environment the right to create its own bucket', () => {
    const config = loadAppConfig({
      ...deployed,
      S3_ENDPOINT: 'https://s3.cpeople.ma',
      S3_BUCKET: 'cpeople-prod',
      S3_ACCESS_KEY_ID: 'key',
      S3_SECRET_ACCESS_KEY: 'secret',
      GOTENBERG_URL: 'https://documents.cpeople.ma/',
      MAIL_HOST: 'smtp.cpeople.ma',
      MAIL_FROM: 'CPeople <no-reply@cpeople.ma>',
      APP_URL: 'https://app.cpeople.ma',
    });

    expect(config.storage.createBucket).toBe(false);
    // The trailing slash goes, so paths can be joined without doubling it.
    expect(config.gotenbergUrl).toBe('https://documents.cpeople.ma');
  });
});

describe('M09 notices can leave the building before the API starts', () => {
  const deployed = {
    DATABASE_URL: 'postgresql://user:pw@db.internal:5432/cpeople',
    KEYCLOAK_ISSUER: 'https://id.cpeople.ma/realms/cpeople',
    S3_ENDPOINT: 'https://storage.cpeople.ma',
    S3_BUCKET: 'cpeople-prod',
    S3_ACCESS_KEY_ID: 'key',
    S3_SECRET_ACCESS_KEY: 'secret',
    GOTENBERG_URL: 'https://documents.cpeople.ma',
  };

  it('refuses to start where it could not send a notice', () => {
    // A leave request that is approved and nobody is told about is a request
    // still sitting in an inbox, so an environment that cannot send does not run.
    expect(() => loadAppConfig(deployed)).toThrow(/MAIL_HOST/);
  });

  it('falls back to the local catcher in a developer checkout', () => {
    const config = loadAppConfig({ CPEOPLE_LOCAL_DEV: 'true' });

    // Mailpit, from infra/docker: it catches everything and delivers nothing,
    // which is the right behaviour on a machine full of invented addresses.
    expect(config.mail.host).toBe('localhost');
    expect(config.mail.port).toBe(1025);
    expect(config.mail.appUrl).toBe('http://localhost:3000');
  });

  it('trims the trailing slash off the address links are built from', () => {
    const config = loadAppConfig({
      ...deployed,
      MAIL_HOST: 'smtp.cpeople.ma',
      MAIL_FROM: 'CPeople <no-reply@cpeople.ma>',
      APP_URL: 'https://app.cpeople.ma/',
    });

    expect(config.mail.appUrl).toBe('https://app.cpeople.ma');
  });
});
