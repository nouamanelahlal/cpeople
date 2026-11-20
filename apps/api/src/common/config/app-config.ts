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
}

const DEFAULT_PORT = 3100;
const DEFAULT_AUDIENCE = 'cpeople-api';

/** The realm served by the local Docker stack (infra/docker/docker-compose.yml). */
const LOCAL_DEV_ISSUER = 'http://localhost:8080/realms/cpeople';

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

  constructor(config: AppConfig) {
    this.localDev = config.localDev;
    this.tenantHeaderAllowed = config.tenantHeaderAllowed;
    this.keycloakIssuer = config.keycloakIssuer;
    this.keycloakAudience = config.keycloakAudience;
    this.port = config.port;
  }
}
