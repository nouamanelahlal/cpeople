import type { Prisma } from './generated/prisma/client.js';
import type { CPeoplePrismaClient } from './client.js';

/** Unprivileged Postgres role the application runs as. Created in migration 0002. */
export const APP_DB_ROLE = 'cpeople_app';

/** Session setting the row-level-security policies read. */
export const TENANT_SETTING = 'app.tenant_id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The transaction-scoped client handed to a withTenant() callback. */
export type TenantClient = Prisma.TransactionClient;

/**
 * Runs `fn` in a transaction that can only see and write one tenant's rows.
 *
 * Inside the transaction it does two things, both reverted when the transaction ends:
 *  - `SET LOCAL ROLE cpeople_app` drops the owner privileges, so the policies apply
 *    even when the pool connects as the database owner;
 *  - `set_config('app.tenant_id', ...)` tells the policies which tenant this is.
 *
 * `tenantId` must come from the verified session (Keycloak token), never from a
 * request body or query string: it is the whole tenant boundary (M21 / HR-08).
 */
export async function withTenant<T>(
  prisma: CPeoplePrismaClient,
  tenantId: string,
  fn: (tx: TenantClient) => Promise<T>,
): Promise<T> {
  if (!UUID.test(tenantId)) {
    throw new Error('withTenant: tenantId must be a UUID');
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL ROLE ${APP_DB_ROLE}`);
    await tx.$queryRaw`SELECT set_config(${TENANT_SETTING}, ${tenantId}, true)`;
    return fn(tx);
  });
}
