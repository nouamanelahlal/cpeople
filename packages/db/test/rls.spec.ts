// Tenant isolation is the first non-negotiable rule (CLAUDE.md rule 1, M21 / HR-08),
// so it is tested against a real Postgres: a policy cannot be proved against a mock.
//
// Fixtures are fake data only (rule 6).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { APP_DB_ROLE, createPrismaClient, withTenant } from '../src/index.js';

/** Owner connection: provisions tenants, which the application itself may not do. */
const owner = createPrismaClient();

/**
 * A pool of exactly one connection, so every query below provably lands on the same
 * Postgres backend — the condition under which a leaked session setting would be
 * visible to the next request. The tests assert the backend pid to make sure of it.
 */
const pooled = createPrismaClient({ maxConnections: 1 });

interface ConnectionState {
  pid: number;
  role: string;
  tenant: string | null;
}

/** What the connection currently believes it is: backend, role and tenant setting. */
async function connectionState(client: {
  $queryRaw: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
}): Promise<ConnectionState> {
  const rows = await client.$queryRaw<ConnectionState[]>`
    SELECT pg_backend_pid() AS pid,
           current_user::text AS role,
           current_setting('app.tenant_id', true) AS tenant
  `;
  const [state] = rows;
  if (!state) {
    throw new Error('connectionState: no row');
  }
  return state;
}

/** Unique per run, so a leftover row from a failed run cannot collide. */
const run = Date.now().toString(36);

let tenantA: { id: string };
let tenantB: { id: string };
let companyA: { id: string };
let companyB: { id: string };

beforeAll(async () => {
  tenantA = await owner.tenant.create({
    data: { slug: `rls-a-${run}`, name: 'RLS Test Tenant A', countryCode: 'MA' },
  });
  tenantB = await owner.tenant.create({
    data: { slug: `rls-b-${run}`, name: 'RLS Test Tenant B', countryCode: 'MA' },
  });

  // Created through withTenant, the same path the API uses.
  companyA = await withTenant(owner, tenantA.id, (tx) =>
    tx.company.create({
      data: {
        tenantId: tenantA.id,
        name: 'Tenant A Company',
        legalName: 'Tenant A Company SARL',
        defaultCurrency: 'MAD',
      },
    }),
  );
  companyB = await withTenant(owner, tenantB.id, (tx) =>
    tx.company.create({
      data: {
        tenantId: tenantB.id,
        name: 'Tenant B Company',
        legalName: 'Tenant B Company SARL',
        defaultCurrency: 'MAD',
      },
    }),
  );
});

afterAll(async () => {
  await owner.company.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
  await owner.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
  await owner.$disconnect();
  await pooled.$disconnect();
});

describe('M21 tenant isolation (row-level security)', () => {
  it('shows a tenant only its own companies', async () => {
    const seenByA = await withTenant(owner, tenantA.id, (tx) => tx.company.findMany());
    const seenByB = await withTenant(owner, tenantB.id, (tx) => tx.company.findMany());

    expect(seenByA.map((c) => c.id)).toEqual([companyA.id]);
    expect(seenByB.map((c) => c.id)).toEqual([companyB.id]);
  });

  it('hides another tenant’s company even when its id is known', async () => {
    const stolen = await withTenant(owner, tenantA.id, (tx) =>
      tx.company.findUnique({ where: { id: companyB.id } }),
    );

    expect(stolen).toBeNull();
  });

  it('counts only its own rows', async () => {
    const count = await withTenant(owner, tenantA.id, (tx) => tx.company.count());

    expect(count).toBe(1);
  });

  it('cannot update another tenant’s company', async () => {
    const result = await withTenant(owner, tenantA.id, (tx) =>
      tx.company.updateMany({ where: { id: companyB.id }, data: { name: 'taken over' } }),
    );

    expect(result.count).toBe(0);

    const untouched = await withTenant(owner, tenantB.id, (tx) =>
      tx.company.findUniqueOrThrow({ where: { id: companyB.id } }),
    );
    expect(untouched.name).toBe('Tenant B Company');
  });

  it('cannot delete another tenant’s company', async () => {
    const result = await withTenant(owner, tenantA.id, (tx) =>
      tx.company.deleteMany({ where: { id: companyB.id } }),
    );

    expect(result.count).toBe(0);
    expect(await withTenant(owner, tenantB.id, (tx) => tx.company.count())).toBe(1);
  });

  it('cannot create a company for another tenant', async () => {
    await expect(
      withTenant(owner, tenantA.id, (tx) =>
        tx.company.create({
          data: {
            tenantId: tenantB.id,
            name: `smuggled-${run}`,
            legalName: 'Smuggled SARL',
            defaultCurrency: 'MAD',
          },
        }),
      ),
    ).rejects.toThrow(/row-level security/i);

    expect(await owner.company.count({ where: { name: `smuggled-${run}` } })).toBe(0);
  });

  it('cannot move its own company to another tenant', async () => {
    await expect(
      withTenant(owner, tenantA.id, (tx) =>
        tx.company.update({ where: { id: companyA.id }, data: { tenantId: tenantB.id } }),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('shows a tenant only its own tenant row', async () => {
    const tenants = await withTenant(owner, tenantA.id, (tx) => tx.tenant.findMany());
    const other = await withTenant(owner, tenantA.id, (tx) =>
      tx.tenant.findUnique({ where: { id: tenantB.id } }),
    );

    expect(tenants.map((t) => t.id)).toEqual([tenantA.id]);
    expect(other).toBeNull();
  });

  it('sees nothing at all when no tenant context is set', async () => {
    const rows = await owner.$transaction(async (tx) => {
      // The application role, deliberately without app.tenant_id.
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${APP_DB_ROLE}`);
      return tx.company.findMany();
    });

    expect(rows).toEqual([]);
  });

  it('does not let the application role switch the policy off', async () => {
    await expect(
      withTenant(owner, tenantA.id, (tx) =>
        tx.$executeRawUnsafe('ALTER TABLE "company" DISABLE ROW LEVEL SECURITY'),
      ),
    ).rejects.toThrow();

    // Still enforced afterwards.
    expect(await withTenant(owner, tenantA.id, (tx) => tx.company.count())).toBe(1);
  });

  it('rejects a tenant id that is not a UUID', async () => {
    await expect(
      withTenant(owner, "' OR 1=1 --", (tx) => tx.company.findMany()),
    ).rejects.toThrow(/must be a UUID/);
  });
});

describe('M21 every tenant-scoped table is protected', () => {
  // Guards rule 1 for tables added later: a new table with tenant_id and no policy
  // fails here instead of leaking in production.
  it('has row-level security enabled, forced and a policy on every table with tenant_id', async () => {
    const tables = await owner.$queryRaw<
      { table_name: string; rls_enabled: boolean; rls_forced: boolean; policy_count: number }[]
    >`
      SELECT c.relname::text AS table_name,
             c.relrowsecurity AS rls_enabled,
             c.relforcerowsecurity AS rls_forced,
             (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid)::int AS policy_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND EXISTS (
          SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped
        )
      ORDER BY c.relname
    `;

    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) {
      expect(table, `${table.table_name}: row-level security`).toMatchObject({
        rls_enabled: true,
        rls_forced: true,
      });
      expect(table.policy_count, `${table.table_name}: policies`).toBeGreaterThan(0);
    }
  });

  it('protects the tenant table itself', async () => {
    const rows = await owner.$queryRaw<{ rls_enabled: boolean; policy_count: number }[]>`
      SELECT c.relrowsecurity AS rls_enabled,
             (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid)::int AS policy_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'tenant'
    `;

    expect(rows[0]?.rls_enabled).toBe(true);
    expect(rows[0]?.policy_count).toBeGreaterThan(0);
  });
});

describe('M21 the tenant context is transaction-scoped', () => {
  // withTenant uses SET LOCAL ROLE and set_config(..., is_local => true). Both end
  // with the transaction, so a pooled connection cannot carry one request's tenant
  // into the next one. Every test here pins the backend pid, so it would fail rather
  // than pass vacuously if the queries happened to land on different connections.

  it('sets the role and the tenant inside the transaction', async () => {
    const inside = await withTenant(pooled, tenantA.id, (tx) => connectionState(tx));

    expect(inside.role).toBe(APP_DB_ROLE);
    expect(inside.tenant).toBe(tenantA.id);
  });

  it('leaves no tenant and no role behind on the connection it borrowed', async () => {
    const inside = await withTenant(pooled, tenantA.id, (tx) => connectionState(tx));
    const after = await connectionState(pooled);

    // Same backend, so this is the very connection that had tenant A's context.
    expect(after.pid).toBe(inside.pid);
    expect(after.tenant).toBeFalsy();
    expect(after.role).not.toBe(APP_DB_ROLE);
  });

  it('leaves nothing behind when the transaction fails', async () => {
    const before = await connectionState(pooled);

    await expect(
      withTenant(pooled, tenantA.id, async (tx) => {
        await tx.company.findMany();
        throw new Error('something went wrong mid-request');
      }),
    ).rejects.toThrow('something went wrong mid-request');

    const after = await connectionState(pooled);

    expect(after.pid).toBe(before.pid);
    expect(after.tenant).toBeFalsy();
    expect(after.role).not.toBe(APP_DB_ROLE);
  });

  it('gives consecutive requests on one connection their own tenant', async () => {
    const first = await withTenant(pooled, tenantA.id, async (tx) => ({
      state: await connectionState(tx),
      companies: await tx.company.findMany(),
    }));
    const second = await withTenant(pooled, tenantB.id, async (tx) => ({
      state: await connectionState(tx),
      companies: await tx.company.findMany(),
    }));

    expect(second.state.pid).toBe(first.state.pid);
    expect(first.companies.map((c) => c.id)).toEqual([companyA.id]);
    expect(second.companies.map((c) => c.id)).toEqual([companyB.id]);
  });

  it('is not fooled by a stale session-level setting on the connection', async () => {
    // Postgres lets any role set a custom setting session-wide, and unlike the
    // transaction-local one withTenant uses, that value would survive a commit.
    // Two things keep it harmless, and this test holds both in place:
    //  - withTenant sets the tenant at the start of every transaction, so the local
    //    value always wins for the duration of a request;
    //  - outside a withTenant transaction the connection is back to the owner role,
    //    which the policies do not apply to anyway, so the stale value selects
    //    nothing on its own.
    try {
      await pooled.$queryRaw`SELECT set_config('app.tenant_id', ${tenantB.id}, false)`;
      expect((await connectionState(pooled)).tenant).toBe(tenantB.id);

      const seen = await withTenant(pooled, tenantA.id, async (tx) => ({
        state: await connectionState(tx),
        companies: await tx.company.findMany(),
      }));

      expect(seen.state.tenant).toBe(tenantA.id);
      expect(seen.companies.map((c) => c.id)).toEqual([companyA.id]);
    } finally {
      await pooled.$queryRaw`SELECT set_config('app.tenant_id', '', false)`;
    }

    expect((await connectionState(pooled)).tenant).toBeFalsy();
  });
});
