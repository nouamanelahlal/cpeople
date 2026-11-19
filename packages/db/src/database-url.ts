// Resolving the database URL. Kept free of imports so that both the Prisma CLI
// config (prisma7.config.ts) and the runtime client can use it.

/**
 * Credentials of the local Docker stack (infra/docker/docker-compose.yml). They are
 * not a secret: the same values are committed in the compose file.
 *
 * They are used only when CPEOPLE_LOCAL_DEV is set, which the repository's own
 * local scripts do (`pnpm dev`, `pnpm test`, `pnpm db:*`) and no deployment ever
 * does. Dev, Test and Prod pass a real DATABASE_URL.
 */
export const LOCAL_DEV_DATABASE_URL =
  'postgresql://cpeople:cpeople_dev@localhost:5432/cpeople?schema=public';

/** True only in a developer's checkout, never in a deployed environment. */
export function isLocalDev(): boolean {
  return process.env.CPEOPLE_LOCAL_DEV === 'true';
}

/**
 * DATABASE_URL, or the local Docker stack when running locally.
 *
 * Outside local development a missing DATABASE_URL is a configuration failure, not
 * something to paper over: falling back to a localhost database in Dev, Test or Prod
 * would either fail obscurely later or, worse, write real payroll data somewhere
 * nobody is looking. So it throws at startup instead.
 */
export function resolveDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  if (isLocalDev()) {
    return LOCAL_DEV_DATABASE_URL;
  }

  throw new Error(
    'DATABASE_URL is not set. Every deployed environment must pass its own database URL.\n' +
      'Working locally? Use the repository scripts (pnpm dev, pnpm test, pnpm db:migrate), ' +
      'which set CPEOPLE_LOCAL_DEV=true and fall back to the local Docker stack.',
  );
}
