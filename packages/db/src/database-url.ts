// Resolving the database URL. Kept free of imports so that both the Prisma CLI
// config (prisma7.config.ts) and the runtime client can use it.

/**
 * Credentials of the local Docker stack (infra/docker/docker-compose.yml), so that
 * `pnpm db:migrate` and `pnpm test` work on a fresh clone with no .env file.
 * Local development only — Dev, Test and Prod each set DATABASE_URL to their own
 * database, with their own secret (CLAUDE.md, Environments).
 */
export const LOCAL_DEV_DATABASE_URL =
  'postgresql://cpeople:cpeople_dev@localhost:5432/cpeople?schema=public';

/** DATABASE_URL when set, otherwise the local Docker stack. */
export function resolveDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : LOCAL_DEV_DATABASE_URL;
}
