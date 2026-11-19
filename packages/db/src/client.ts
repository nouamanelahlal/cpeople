import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { resolveDatabaseUrl } from './database-url.js';

export type CPeoplePrismaClient = InstanceType<typeof PrismaClient>;

export interface PrismaClientOptions {
  /** Maximum pooled connections. Mainly for tests that need one shared connection. */
  maxConnections?: number;
}

/**
 * Prisma client for CPeople.
 *
 * This connection is the *owner* connection: it runs migrations, provisions tenants
 * and seeds fake data. Application code must never read business tables through it
 * directly — it goes through withTenant(), which drops to the unprivileged
 * cpeople_app role so that the row-level-security policies apply (CLAUDE.md rule 1).
 *
 * Throws if DATABASE_URL is missing outside local development.
 */
export function createPrismaClient(options: PrismaClientOptions = {}): CPeoplePrismaClient {
  const adapter = new PrismaPg({
    connectionString: resolveDatabaseUrl(),
    ...(options.maxConnections === undefined ? {} : { max: options.maxConnections }),
  });
  return new PrismaClient({ adapter });
}
