import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { resolveDatabaseUrl, resolveMigrationDatabaseUrl } from './database-url.js';

export type CPeoplePrismaClient = InstanceType<typeof PrismaClient>;

export interface PrismaClientOptions {
  /** Maximum pooled connections. Mainly for tests that need one shared connection. */
  maxConnections?: number;
}

function clientFor(connectionString: string, options: PrismaClientOptions): CPeoplePrismaClient {
  const adapter = new PrismaPg({
    connectionString,
    ...(options.maxConnections === undefined ? {} : { max: options.maxConnections }),
  });
  return new PrismaClient({ adapter });
}

/**
 * The runtime client. Connects as cpeople_app, which owns no table and holds only
 * the grants it needs, so every query it runs is subject to the row-level-security
 * policies — including one that forgets to go through withTenant(), which then sees
 * nothing rather than every tenant's rows (CLAUDE.md rule 1, M21).
 *
 * Tenant-scoped work goes through withTenant(). This client on its own is not a way
 * around that: without a tenant context the policies match no rows.
 *
 * Throws if DATABASE_URL is missing outside local development.
 */
export function createPrismaClient(options: PrismaClientOptions = {}): CPeoplePrismaClient {
  return clientFor(resolveDatabaseUrl(), options);
}

/**
 * The owner client, for migrations, seeds and tenant provisioning.
 *
 * It can read and write every tenant's rows, so nothing that serves a request may
 * use it — the API never builds one. Keep its use to command-line tools.
 *
 * Throws if MIGRATION_DATABASE_URL is missing outside local development.
 */
export function createMigrationPrismaClient(
  options: PrismaClientOptions = {},
): CPeoplePrismaClient {
  return clientFor(resolveMigrationDatabaseUrl(), options);
}
