// Resolving the database URLs. Kept free of imports so that both the Prisma CLI
// config (prisma7.config.ts) and the runtime client can use it.
//
// CPeople uses two connections, and they are not interchangeable:
//
//   DATABASE_URL            the runtime pool. Connects as cpeople_app, which owns
//                           nothing and holds only the grants it needs, so the
//                           row-level-security policies apply to every query it runs.
//   MIGRATION_DATABASE_URL  the owner. Runs migrations and provisions tenants.
//                           Never used to serve a request.

/**
 * Local Docker stack (infra/docker/docker-compose.yml). Not a secret: the owner
 * credentials are already committed in the compose file, and the runtime password is
 * set on a throwaway database by scripts/local-dev-role.mjs.
 *
 * Used only when CPEOPLE_LOCAL_DEV is set, which the repository's own scripts do and
 * no deployment does.
 */
export const LOCAL_DEV_DATABASE_URL =
  'postgresql://cpeople_app:cpeople_app_dev@localhost:5432/cpeople?schema=public';

export const LOCAL_DEV_MIGRATION_DATABASE_URL =
  'postgresql://cpeople:cpeople_dev@localhost:5432/cpeople?schema=public';

/** True only in a developer's checkout or a throwaway CI database. */
export function isLocalDev(): boolean {
  return process.env.CPEOPLE_LOCAL_DEV === 'true';
}

function resolve(variable: string, localFallback: string, purpose: string): string {
  const fromEnv = process.env[variable]?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  if (isLocalDev()) {
    return localFallback;
  }

  throw new Error(
    `${variable} is not set. Every deployed environment must pass its own ${purpose}.\n` +
      'Working locally? Use the repository scripts (pnpm dev, pnpm test, pnpm db:migrate), ' +
      'which set CPEOPLE_LOCAL_DEV=true and fall back to the local Docker stack.',
  );
}

/**
 * The runtime database URL: the unprivileged cpeople_app role.
 *
 * Outside local development a missing DATABASE_URL is a configuration failure, not
 * something to paper over: falling back to a localhost database in Dev, Test or Prod
 * would either fail obscurely later or, worse, write real payroll data somewhere
 * nobody is looking. So it throws at startup instead.
 */
export function resolveDatabaseUrl(): string {
  return resolve('DATABASE_URL', LOCAL_DEV_DATABASE_URL, 'runtime database URL');
}

/**
 * The owner database URL, for migrations and tenant provisioning only.
 *
 * The owner can read every tenant's rows, so nothing that serves a request may use
 * it. The API never builds a client from this.
 */
export function resolveMigrationDatabaseUrl(): string {
  return resolve('MIGRATION_DATABASE_URL', LOCAL_DEV_MIGRATION_DATABASE_URL, 'migration URL');
}
