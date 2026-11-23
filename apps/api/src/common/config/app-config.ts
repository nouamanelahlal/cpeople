import { Injectable } from '@nestjs/common';

/**
 * Settings the API reads from the environment, resolved once at startup.
 *
 * Everything here fails closed: a missing or unreadable setting is a startup
 * failure, never a quiet default that weakens the tenant boundary.
 */
export interface AppConfig {
  /**
   * True only in a developer's checkout. Set by the repository's own local scripts
   * (`pnpm dev`, `pnpm test`, `pnpm db:*`); no deployment sets it, so Dev, Test and
   * Prod are all treated as deployed environments.
   */
  readonly localDev: boolean;

  /**
   * Whether an `x-tenant-id` request header may choose the tenant.
   *
   * A local-development convenience from before sign-in existed. A signed-in
   * request now carries its tenant in the token (M02 / HR-08), and letting a client
   * choose its own tenant instead would hand it every other tenant's payroll, so the
   * header is allowed only when it is explicitly switched on *and* the process is a
   * local one.
   */
  readonly tenantHeaderAllowed: boolean;

  /** The Keycloak realm that issues tokens, e.g. https://id.cpeople.ma/realms/cpeople. */
  readonly keycloakIssuer: string;

  /** The audience the API requires in a token: its own client id. */
  readonly keycloakAudience: string;

  readonly port: number;

  /** Where uploaded documents are kept (CLAUDE.md: S3-compatible storage). */
  readonly storage: StorageConfig;

  /** Where HTML is turned into PDF (CLAUDE.md: Gotenberg, never a browser here). */
  readonly gotenbergUrl: string;

  /** Where the notices about leave are sent from, and where they link back to. */
  readonly mail: MailConfig;
}

/**
 * Sending e-mail.
 *
 * A developer's checkout talks to the Mailpit in infra/docker, which catches
 * everything and delivers nothing — the right behaviour for a machine full of
 * invented addresses. A deployed environment passes its own relay, and the API
 * refuses to start without one rather than silently dropping notices that people
 * are waiting for.
 */
export interface MailConfig {
  readonly host: string;
  readonly port: number;
  readonly from: string;
  /** The address of the web application, for the links inside a message. */
  readonly appUrl: string;
}

/**
 * The object store's settings.
 *
 * A developer's checkout falls back to the local Docker stack, as it does for the
 * database and the realm. A deployed environment passes its own, and the API
 * refuses to start without them rather than quietly writing documents nowhere.
 */
export interface StorageConfig {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  /** Local stacks have no DNS for buckets, and no bucket until something makes one. */
  readonly createBucket: boolean;
}

const DEFAULT_PORT = 3100;

/** The Mailpit and the web app in a developer's checkout. */
const LOCAL_DEV_MAIL = {
  host: 'localhost',
  port: 1025,
  from: 'CPeople <no-reply@cpeople.local>',
  appUrl: 'http://localhost:3000',
} as const;
const DEFAULT_AUDIENCE = 'cpeople-api';

/** The realm served by the local Docker stack (infra/docker/docker-compose.yml). */
const LOCAL_DEV_ISSUER = 'http://localhost:8080/realms/cpeople';

/** The object store in infra/docker/docker-compose.yml. */
/** The document service in infra/docker/docker-compose.yml. */
const LOCAL_DEV_GOTENBERG = 'http://localhost:3001';

const LOCAL_DEV_STORAGE = {
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  bucket: 'cpeople-local',
  accessKeyId: 'cpeople',
  secretAccessKey: 'cpeople_dev',
} as const;

function flag(name: string, env: NodeJS.ProcessEnv): boolean {
  return env[name]?.trim() === 'true';
}

/**
 * Reads and checks the environment. Throws on a combination that must never run,
 * so the process dies at boot with a clear message instead of serving traffic with
 * a hole in it.
 */
export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const localDev = flag('CPEOPLE_LOCAL_DEV', env);
  const tenantHeaderAllowed = flag('TENANT_HEADER_ALLOWED', env);

  if (tenantHeaderAllowed && !localDev) {
    throw new Error(
      'TENANT_HEADER_ALLOWED=true outside local development.\n' +
        'The x-tenant-id header lets the caller choose its own tenant, so it is for ' +
        'local work only. Remove it from this environment; Dev, Test and Prod take the ' +
        'tenant from the signed-in session (M02).',
    );
  }

  if (!localDev && !env.DATABASE_URL?.trim()) {
    throw new Error(
      'DATABASE_URL is not set. Every deployed environment must pass its own database URL.',
    );
  }

  const keycloakIssuer = env.KEYCLOAK_ISSUER?.trim() || (localDev ? LOCAL_DEV_ISSUER : '');
  if (!keycloakIssuer) {
    throw new Error(
      'KEYCLOAK_ISSUER is not set. Every deployed environment must name the realm that ' +
        'issues its tokens; without it the API cannot tell a real token from a forged one.',
    );
  }
  if (!localDev && !keycloakIssuer.startsWith('https://')) {
    // Tokens and the keys that verify them must not travel in the clear.
    throw new Error(`KEYCLOAK_ISSUER must be an https URL outside local development, got "${keycloakIssuer}".`);
  }

  // Storage first, so an environment missing both is told about both in the
  // order it will meet them.
  const storage = loadStorageConfig(env, localDev);

  if (!localDev && !env.GOTENBERG_URL?.trim()) {
    throw new Error(
      'GOTENBERG_URL is not set. Contracts and payslips are rendered to PDF by Gotenberg, ' +
        'and an environment that cannot reach it would offer a button that always fails.',
    );
  }

  const port = Number(env.API_PORT ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`API_PORT must be a positive integer, got "${env.API_PORT}".`);
  }

  return {
    localDev,
    tenantHeaderAllowed,
    keycloakIssuer: keycloakIssuer.replace(/\/$/, ''),
    keycloakAudience: env.KEYCLOAK_AUDIENCE?.trim() || DEFAULT_AUDIENCE,
    port,
    storage,
    gotenbergUrl: (env.GOTENBERG_URL?.trim() || (localDev ? LOCAL_DEV_GOTENBERG : '')).replace(
      /\/$/,
      '',
    ),
    mail: loadMailConfig(env, localDev),
  };
}

function loadMailConfig(env: NodeJS.ProcessEnv, localDev: boolean): MailConfig {
  const host = env.MAIL_HOST?.trim();
  const from = env.MAIL_FROM?.trim();
  const appUrl = env.APP_URL?.trim();

  if (localDev && !host) {
    return { ...LOCAL_DEV_MAIL };
  }

  if (!host || !from || !appUrl) {
    throw new Error(
      'MAIL_HOST, MAIL_FROM and APP_URL must all be set. Leave requests notify the people ' +
        'waiting on them, and an environment that cannot send would approve requests nobody ' +
        'was told about.',
    );
  }

  const port = Number(env.MAIL_PORT ?? 25);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`MAIL_PORT must be a positive integer, got "${env.MAIL_PORT}".`);
  }

  return { host, port, from, appUrl: appUrl.replace(/\/$/, '') };
}

function loadStorageConfig(env: NodeJS.ProcessEnv, localDev: boolean): StorageConfig {
  const endpoint = env.S3_ENDPOINT?.trim();
  const bucket = env.S3_BUCKET?.trim();
  const accessKeyId = env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY?.trim();

  if (localDev && !endpoint) {
    return { ...LOCAL_DEV_STORAGE, createBucket: true };
  }

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must all be set. ' +
        'Employee documents are kept in object storage, and an environment that cannot ' +
        'reach it would accept uploads and lose them.',
    );
  }

  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region: env.S3_REGION?.trim() || LOCAL_DEV_STORAGE.region,
    // A deployed bucket is provisioned with the environment, not by the API.
    createBucket: false,
  };
}

/**
 * Injectable wrapper, so services depend on the config rather than on process.env.
 * ConfigModule builds it from loadAppConfig(); tests pass settings in directly.
 */
@Injectable()
export class AppConfigService implements AppConfig {
  readonly localDev: boolean;
  readonly tenantHeaderAllowed: boolean;
  readonly keycloakIssuer: string;
  readonly keycloakAudience: string;
  readonly port: number;
  readonly storage: StorageConfig;
  readonly gotenbergUrl: string;
  readonly mail: MailConfig;

  constructor(config: AppConfig) {
    this.localDev = config.localDev;
    this.tenantHeaderAllowed = config.tenantHeaderAllowed;
    this.keycloakIssuer = config.keycloakIssuer;
    this.keycloakAudience = config.keycloakAudience;
    this.port = config.port;
    this.storage = config.storage;
    this.gotenbergUrl = config.gotenbergUrl;
    this.mail = config.mail;
  }
}
