import type { Prisma } from './generated/prisma/client.js';
import type { CPeoplePrismaClient } from './client.js';

/** Unprivileged Postgres role the application runs as. Created in migration 0002. */
export const APP_DB_ROLE = 'cpeople_app';

/** Session setting the row-level-security policies read. */
export const TENANT_SETTING = 'app.tenant_id';

/**
 * How long a tenant transaction may wait for a connection, and then run.
 *
 * Prisma's defaults are two seconds and five, which are the numbers of a quick
 * write on an idle machine. Everything here runs inside one of these — a screen
 * that asks eight questions at once is one transaction, not eight — so under
 * load the default is not a slow query, it is a failed one, and a failed read
 * becomes a dashboard full of dashes. These are generous on purpose; a read that
 * genuinely takes twenty seconds is a bug to find, not to hide.
 */
const TRANSACTION = { maxWait: 15_000, timeout: 30_000 } as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The transaction-scoped client handed to a withTenant() callback. */
export type TenantClient = Prisma.TransactionClient;

/**
 * Runs `fn` in a transaction that can only see and write one tenant's rows.
 *
 * Inside the transaction it does two things, both of them transaction-scoped, so a
 * pooled connection cannot carry one request's tenant into the next:
 *  - `SET LOCAL ROLE cpeople_app` drops the owner privileges, so the policies apply
 *    even when the pool connects as the database owner. `LOCAL` ends it at commit
 *    or rollback;
 *  - `set_config('app.tenant_id', ..., true)` tells the policies which tenant this
 *    is. The third argument is `is_local`: the value is dropped with the
 *    transaction, rather than staying on the connection.
 *
 * Both are proved in test/rls.spec.ts, on a pool of one connection.
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
  }, TRANSACTION);
}
