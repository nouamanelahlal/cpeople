// Tenant isolation is the first non-negotiable rule (CLAUDE.md rule 1, M21 / HR-08),
// so it is tested against a real Postgres: a policy cannot be proved against a mock.
//
// Fixtures are fake data only (rule 6).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  APP_DB_ROLE,
  createMigrationPrismaClient,
  createPrismaClient,
  withTenant,
} from '../src/index.js';

/**
 * The runtime pool, exactly as the API has it: connected as cpeople_app, which owns
 * nothing and is subject to every policy.
 */
const runtime = createPrismaClient();

/** Owner connection: provisions tenants, which the application itself may not do. */
const owner = createMigrationPrismaClient();

/**
 * The runtime pool narrowed to exactly one connection, so every query below provably
 * lands on the same Postgres backend — the condition under which a leaked session
 * setting would be visible to the next request. The tests assert the backend pid to
 * make sure of it.
 */
const pooled = createPrismaClient({ maxConnections: 1 });

/**
 * One owner connection. withTenant() is meant to be safe even here � the belt to the
 * runtime role's braces � so the role change it makes is visible and testable.
 */
const pooledOwner = createMigrationPrismaClient({ maxConnections: 1 });

interface ConnectionState {
  pid: number;
  role: string;
  /** The role the connection logged in as, which SET LOCAL ROLE reverts to. */
  session_role: string;
  tenant: string | null;
}

/** What the connection currently believes it is: backend, role and tenant setting. */
async function connectionState(client: {
  $queryRaw: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
}): Promise<ConnectionState> {
  const rows = await client.$queryRaw<ConnectionState[]>`
    SELECT pg_backend_pid() AS pid,
           current_user::text AS role,
           session_user::text AS session_role,
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
  companyA = await withTenant(runtime, tenantA.id, (tx) =>
    tx.company.create({
      data: {
        tenantId: tenantA.id,
        name: 'Tenant A Company',
        legalName: 'Tenant A Company SARL',
        defaultCurrency: 'MAD',
      },
    }),
  );
  companyB = await withTenant(runtime, tenantB.id, (tx) =>
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
  await runtime.$disconnect();
  await pooled.$disconnect();
  await pooledOwner.$disconnect();
});

describe('M21 tenant isolation (row-level security)', () => {
  it('shows a tenant only its own companies', async () => {
    const seenByA = await withTenant(runtime, tenantA.id, (tx) => tx.company.findMany());
    const seenByB = await withTenant(runtime, tenantB.id, (tx) => tx.company.findMany());

    expect(seenByA.map((c) => c.id)).toEqual([companyA.id]);
    expect(seenByB.map((c) => c.id)).toEqual([companyB.id]);
  });

  it('hides another tenant’s company even when its id is known', async () => {
    const stolen = await withTenant(runtime, tenantA.id, (tx) =>
      tx.company.findUnique({ where: { id: companyB.id } }),
    );

    expect(stolen).toBeNull();
  });

  it('counts only its own rows', async () => {
    const count = await withTenant(runtime, tenantA.id, (tx) => tx.company.count());

    expect(count).toBe(1);
  });

  it('cannot update another tenant’s company', async () => {
    const result = await withTenant(runtime, tenantA.id, (tx) =>
      tx.company.updateMany({ where: { id: companyB.id }, data: { name: 'taken over' } }),
    );

    expect(result.count).toBe(0);

    const untouched = await withTenant(runtime, tenantB.id, (tx) =>
      tx.company.findUniqueOrThrow({ where: { id: companyB.id } }),
    );
    expect(untouched.name).toBe('Tenant B Company');
  });

  it('cannot delete another tenant’s company', async () => {
    const result = await withTenant(runtime, tenantA.id, (tx) =>
      tx.company.deleteMany({ where: { id: companyB.id } }),
    );

    expect(result.count).toBe(0);
    expect(await withTenant(runtime, tenantB.id, (tx) => tx.company.count())).toBe(1);
  });

  it('cannot create a company for another tenant', async () => {
    await expect(
      withTenant(runtime, tenantA.id, (tx) =>
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
      withTenant(runtime, tenantA.id, (tx) =>
        tx.company.update({ where: { id: companyA.id }, data: { tenantId: tenantB.id } }),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('shows a tenant only its own tenant row', async () => {
    const tenants = await withTenant(runtime, tenantA.id, (tx) => tx.tenant.findMany());
    const other = await withTenant(runtime, tenantA.id, (tx) =>
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
      withTenant(runtime, tenantA.id, (tx) =>
        tx.$executeRawUnsafe('ALTER TABLE "company" DISABLE ROW LEVEL SECURITY'),
      ),
    ).rejects.toThrow();

    // Still enforced afterwards.
    expect(await withTenant(runtime, tenantA.id, (tx) => tx.company.count())).toBe(1);
  });

  it('rejects a tenant id that is not a UUID', async () => {
    await expect(
      withTenant(runtime, "' OR 1=1 --", (tx) => tx.company.findMany()),
    ).rejects.toThrow(/must be a UUID/);
  });
});

interface TableProtection {
  table_name: string;
  rls_enabled: boolean;
  rls_forced: boolean;
  policy_count: number;
}

/**
 * Every tenant-scoped table: anything carrying tenant_id, plus `tenant` itself,
 * which is scoped by its own id.
 */
async function tenantScopedTables(): Promise<TableProtection[]> {
  return owner.$queryRaw<TableProtection[]>`
    SELECT c.relname::text AS table_name,
           c.relrowsecurity AS rls_enabled,
           c.relforcerowsecurity AS rls_forced,
           (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid)::int AS policy_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND (
        c.relname = 'tenant'
        OR EXISTS (
          SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped
        )
      )
    ORDER BY c.relname
  `;
}

describe('M21 every tenant-scoped table is protected', () => {
  // Guards rule 1 for tables added later: a new table with tenant_id and no policy,
  // or with row-level security enabled but not forced, fails here instead of leaking
  // in production.
  it('has row-level security enabled, forced and a policy on every tenant-scoped table', async () => {
    const tables = await tenantScopedTables();

    expect(tables.map((t) => t.table_name)).toEqual(expect.arrayContaining(['company', 'tenant']));
    for (const table of tables) {
      expect(table.rls_enabled, `${table.table_name}: row-level security is enabled`).toBe(true);
      // Without FORCE, the policies do not apply to the table's owner, so anything
      // connecting as the owner would read every tenant's rows.
      expect(table.rls_forced, `${table.table_name}: row-level security is FORCEd`).toBe(true);
      expect(table.policy_count, `${table.table_name}: has a policy`).toBeGreaterThan(0);
    }
  });

  it('protects the tenant table itself', async () => {
    const tenantTable = (await tenantScopedTables()).find((t) => t.table_name === 'tenant');

    expect(tenantTable).toMatchObject({ rls_enabled: true, rls_forced: true });
    expect(tenantTable?.policy_count).toBeGreaterThan(0);
  });
});

describe('M21 the runtime pool fails closed', () => {
  // The API's pool connects as cpeople_app, which owns no table. Any query it runs
  // is subject to the policies, so forgetting withTenant() returns nothing instead
  // of every tenant's rows.

  it('connects as the unprivileged runtime role, not as the owner', async () => {
    const state = await connectionState(runtime);

    expect(state.role).toBe(APP_DB_ROLE);
    expect(state.tenant).toBeFalsy();
  });

  it('returns zero rows, not every row, for a query that skips withTenant', async () => {
    // The rows exist: the owner can see them.
    expect(await owner.company.count()).toBeGreaterThanOrEqual(2);
    expect(await owner.tenant.count()).toBeGreaterThanOrEqual(2);

    // The runtime pool, with no tenant context, sees none of them.
    expect(await runtime.company.findMany()).toEqual([]);
    expect(await runtime.company.count()).toBe(0);
    expect(await runtime.tenant.findMany()).toEqual([]);
    expect(await runtime.company.findUnique({ where: { id: companyA.id } })).toBeNull();
  });

  it('cannot write outside a tenant context either', async () => {
    await expect(
      runtime.company.create({
        data: {
          tenantId: tenantA.id,
          name: `unscoped-${run}`,
          legalName: 'Unscoped SARL',
          defaultCurrency: 'MAD',
        },
      }),
    ).rejects.toThrow(/row-level security/i);

    expect(await owner.company.count({ where: { name: `unscoped-${run}` } })).toBe(0);
  });

  it('cannot provision a tenant, which is the owner’s job', async () => {
    await expect(
      runtime.tenant.create({
        data: { slug: `runtime-${run}`, name: 'Runtime Tenant', countryCode: 'MA' },
      }),
    ).rejects.toThrow(/permission denied/i);
  });

  it('cannot read a table it was never granted', async () => {
    await expect(
      runtime.$queryRawUnsafe('SELECT count(*) FROM _prisma_migrations'),
    ).rejects.toThrow(/permission denied/i);
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
    // SET LOCAL ROLE is gone: the connection is back to whoever it logged in as.
    expect(after.role).toBe(after.session_role);
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
    expect(after.role).toBe(after.session_role);
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

describe('M21 withTenant protects an owner connection too', () => {
  // The runtime pool is cpeople_app, so the policies apply to it whatever it does.
  // withTenant does not rely on that: it drops to the same role itself, which is what
  // keeps a command-line tool or a future provisioning job from reading across
  // tenants when it means to work inside one.

  it('drops the owner to the runtime role for the transaction, then gives it back', async () => {
    const inside = await withTenant(pooledOwner, tenantA.id, (tx) => connectionState(tx));
    const after = await connectionState(pooledOwner);

    expect(inside.role).toBe(APP_DB_ROLE);
    expect(inside.session_role).not.toBe(APP_DB_ROLE);
    expect(inside.tenant).toBe(tenantA.id);

    expect(after.pid).toBe(inside.pid);
    expect(after.role).toBe(after.session_role);
    expect(after.role).not.toBe(APP_DB_ROLE);
    expect(after.tenant).toBeFalsy();
  });

  it('isolates an owner connection to one tenant', async () => {
    const seen = await withTenant(pooledOwner, tenantA.id, (tx) => tx.company.findMany());

    expect(seen.map((c) => c.id)).toEqual([companyA.id]);
    // The same connection, outside withTenant, is the owner again and sees everything.
    expect(await pooledOwner.company.count()).toBeGreaterThanOrEqual(2);
  });
});

describe('M21 what is written once stays written', () => {
  // Several tables in this schema are evidence rather than state: an audit
  // event, a leave calculation, a decision, a balance adjustment, a correction,
  // a punch. The application is not trusted to leave them alone — the runtime
  // role simply has no UPDATE or DELETE on them, so a bug cannot rewrite
  // history and neither can anybody who finds a way to run SQL as the API.
  //
  // This walks them rather than testing one, so that a migration which grants
  // the privilege back fails here instead of quietly in production.
  const insertOnly = [
    'audit_event',
    'leave_calculation',
    'leave_decision',
    'leave_balance_adjustment',
    'leave_correction',
    'punch',
  ] as const;

  it.each(insertOnly)('%s cannot be updated or deleted by the runtime role', async (table) => {
    const [row] = await owner.$queryRawUnsafe<{ can_update: boolean; can_delete: boolean }[]>(
      `select has_table_privilege($1, $2, 'UPDATE') as can_update,
              has_table_privilege($1, $2, 'DELETE') as can_delete`,
      APP_DB_ROLE,
      table,
    );

    expect(row?.can_update, `${table}: the runtime role must not UPDATE`).toBe(false);
    expect(row?.can_delete, `${table}: the runtime role must not DELETE`).toBe(false);
  });

  // The imported file is the same kind of promise, kept one column at a time:
  // an import row's status and counts move as it is committed, but the bytes it
  // read and the hash taken of them never change. That is what makes the hash
  // check at commit worth doing.
  it('an imported file and its hash cannot be rewritten, while its status still can', async () => {
    const [row] = await owner.$queryRawUnsafe<
      { content: boolean; hash: boolean; status: boolean }[]
    >(
      `select has_column_privilege($1, 'attendance_import', 'content', 'UPDATE') as content,
              has_column_privilege($1, 'attendance_import', 'content_sha256', 'UPDATE') as hash,
              has_column_privilege($1, 'attendance_import', 'status', 'UPDATE') as status`,
      APP_DB_ROLE,
    );

    expect(row?.content, 'the imported file must not be updatable').toBe(false);
    expect(row?.hash, 'the hash of the imported file must not be updatable').toBe(false);
    expect(row?.status, 'an import must still be able to change status').toBe(true);
  });
});

describe('M21 a rate is never edited in place', () => {
  // Parameter rows are effective-dated (CLAUDE.md rule 3): changing a rule
  // writes a new row from a date and closes the old one. Leave rules already
  // work that way in the application, and overtime rules have no screen yet —
  // which is the moment to make it a fact rather than a habit, because the
  // screen that edits them is still to be built.
  //
  // What a legitimate change touches stays updatable: closing a row, marking it
  // confirmed, its note, and the timestamp the ORM writes. Everything that
  // decides what a worked day is worth does not.
  const locked = [
    'band_code',
    'day_type',
    'time_from',
    'time_to',
    'rate_percent',
    'applies_to',
    'effective_from',
  ] as const;

  const open = ['effective_to', 'confirmed', 'note', 'updated_at'] as const;

  it.each(locked)('overtime_rule.%s cannot be updated by the runtime role', async (column) => {
    const [row] = await owner.$queryRawUnsafe<{ allowed: boolean }[]>(
      `select has_column_privilege($1, 'overtime_rule', $2, 'UPDATE') as allowed`,
      APP_DB_ROLE,
      column,
    );

    expect(row?.allowed, `overtime_rule.${column} must be write-once`).toBe(false);
  });

  it.each(open)('overtime_rule.%s can still be updated', async (column) => {
    const [row] = await owner.$queryRawUnsafe<{ allowed: boolean }[]>(
      `select has_column_privilege($1, 'overtime_rule', $2, 'UPDATE') as allowed`,
      APP_DB_ROLE,
      column,
    );

    expect(row?.allowed, `overtime_rule.${column} is part of a legitimate change`).toBe(true);
  });

  it('refuses an in-place rate change even when the application tries one', async () => {
    // The privileges above say what Postgres will allow; this proves it. A
    // screen that edits a rate rather than writing a new row fails here.
    const rule = await owner.overtimeRule.findFirst({ select: { id: true, tenantId: true } });
    if (!rule) return;

    await expect(
      withTenant(runtime, rule.tenantId, (tx) =>
        tx.overtimeRule.update({ where: { id: rule.id }, data: { ratePercent: 999 } }),
      ),
    ).rejects.toThrow();
  });
});

describe('M12 a company rate is never edited in place either', () => {
  // CIMR and the per-company contributions that follow it are effective-dated
  // the same way overtime rules are, and for the same reason: changing a rate
  // in place would rewrite what past payslips were calculated from. A change is
  // a new row from a date; the row it replaces is closed. That is what makes
  // these rows their own insert-only history of what the company was charged.
  const locked = ['code', 'rate', 'effective_from'] as const;
  const open = ['effective_to', 'confirmed', 'note', 'updated_at'] as const;

  it.each(locked)(
    'tenant_contribution_rate.%s cannot be updated by the runtime role',
    async (column) => {
      const [row] = await owner.$queryRawUnsafe<{ allowed: boolean }[]>(
        `select has_column_privilege($1, 'tenant_contribution_rate', $2, 'UPDATE') as allowed`,
        APP_DB_ROLE,
        column,
      );

      expect(row?.allowed, `tenant_contribution_rate.${column} must be write-once`).toBe(false);
    },
  );

  it.each(open)('tenant_contribution_rate.%s can still be updated', async (column) => {
    const [row] = await owner.$queryRawUnsafe<{ allowed: boolean }[]>(
      `select has_column_privilege($1, 'tenant_contribution_rate', $2, 'UPDATE') as allowed`,
      APP_DB_ROLE,
      column,
    );

    expect(row?.allowed, `tenant_contribution_rate.${column} is a legitimate change`).toBe(true);
  });

  it('refuses an in-place rate change even when the application tries one', async () => {
    const rate = await owner.tenantContributionRate.findFirst({
      select: { id: true, tenantId: true },
    });
    if (!rate) return;

    await expect(
      withTenant(runtime, rate.tenantId, (tx) =>
        tx.tenantContributionRate.update({
          where: { id: rate.id },
          data: { rate: 0.99 },
        }),
      ),
    ).rejects.toThrow();
  });
});

describe('M12 a contribution rate is a fraction, and the database knows it', () => {
  // 0.0600 is six per cent. The invitation to get this wrong is obvious —
  // "six per cent" is typed as 6 — and numeric(6,4) accepts it without a
  // murmur, so a 600% CIMR would reach a payslip and nothing downstream would
  // question it. The column is called `rate` rather than `ratePercent`, and
  // the check is there for the day the name is not read.
  it('refuses a rate above 1', async () => {
    const tenant = await owner.tenant.findFirst({ select: { id: true } });
    if (!tenant) return;

    await expect(
      withTenant(runtime, tenant.id, (tx) =>
        tx.tenantContributionRate.create({
          data: {
            tenantId: tenant.id,
            code: 'TEST_TOO_BIG',
            rate: 6,
            effectiveFrom: new Date('2026-01-01T00:00:00Z'),
            createdBy: 'test',
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it('refuses a rate below zero', async () => {
    const tenant = await owner.tenant.findFirst({ select: { id: true } });
    if (!tenant) return;

    await expect(
      withTenant(runtime, tenant.id, (tx) =>
        tx.tenantContributionRate.create({
          data: {
            tenantId: tenant.id,
            code: 'TEST_NEGATIVE',
            rate: -0.01,
            effectiveFrom: new Date('2026-01-01T00:00:00Z'),
            createdBy: 'test',
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it('accepts a fraction, which is what a rate is', async () => {
    const tenant = await owner.tenant.findFirst({ select: { id: true } });
    if (!tenant) return;

    const row = await withTenant(runtime, tenant.id, (tx) =>
      tx.tenantContributionRate.create({
        data: {
          tenantId: tenant.id,
          code: 'TEST_FINE',
          rate: 0.06,
          effectiveFrom: new Date('2026-01-01T00:00:00Z'),
          createdBy: 'test',
        },
      }),
    );

    expect(Number(row.rate)).toBeCloseTo(0.06, 4);

    await owner.tenantContributionRate.delete({ where: { id: row.id } });
  });
});

describe('M10 an overtime rate is a percentage, and the database knows it', () => {
  // `overtime_rule.rate_percent` holds 25 for twenty-five per cent, while
  // `tenant_contribution_rate.rate` holds 0.0600 for six. Each is right on its
  // own terms; the pair invites typing one in the shape of the other, and
  // numeric(6,2) takes either without complaint.
  //
  // The two mistakes run in opposite directions, so a ceiling alone is not
  // enough: 0.25 sits comfortably inside any sane range. The floor is one per
  // cent — a quarter of a per cent is not a policy, it is a fraction that
  // escaped — and zero stays allowed, because a band switched off is a real
  // thing to want.
  async function tryRate(rate: number): Promise<'written' | 'refused'> {
    const tenant = await owner.tenant.findFirst({ select: { id: true } });
    if (!tenant) return 'refused';

    try {
      const row = await withTenant(runtime, tenant.id, (tx) =>
        tx.overtimeRule.create({
          data: {
            tenantId: tenant.id,
            bandCode: 'TEST_BAND',
            dayType: 'working',
            timeFrom: '06:00',
            timeTo: '21:00',
            ratePercent: rate,
            effectiveFrom: new Date('2026-01-01T00:00:00Z'),
          },
        }),
      );

      await owner.overtimeRule.delete({ where: { id: row.id } });
      return 'written';
    } catch {
      return 'refused';
    }
  }

  it('refuses the fraction somebody meant as a percentage', async () => {
    expect(await tryRate(0.25), '0.25 is 25% written as a fraction').toBe('refused');
  });

  it('refuses a percentage multiplied by a hundred', async () => {
    expect(await tryRate(2500), '2500 is 25% written as basis points').toBe('refused');
  });

  it('refuses more than triple pay', async () => {
    expect(await tryRate(350)).toBe('refused');
  });

  it('accepts a percentage, and a band switched off', async () => {
    expect(await tryRate(25)).toBe('written');
    expect(await tryRate(0)).toBe('written');
  });
});

describe('M21 an empty branch inside an OR matches nothing', () => {
  /**
   * The trap that cost a screen (M10, exceptions).
   *
   * On its own, `{}` is "no filter" and matches every row — which is what makes
   * `employeeScope()` returning `{}` correct for somebody who may see
   * everybody. **Inside an `OR` it is the opposite.** An empty branch
   * contributes nothing, so the `OR` quietly collapses to whatever its other
   * branches say.
   *
   * The exceptions list asked for "every exception that hangs off a day the
   * reader may see, or that hangs off no day at all" and built it as
   * `OR: [{ workDay: scope }, { workDayId: null }]`. For HR the scope was
   * empty, so the first branch disappeared and HR saw only the three rows with
   * no day — while the counts beside them, built without the `OR`, said
   * forty-four.
   *
   * Two rows and no relation at all are enough to show it.
   */
  beforeAll(async () => {
    await withTenant(runtime, tenantA.id, (tx) =>
      tx.attendanceImport.createMany({
        data: [
          { tenantId: tenantA.id, fileName: 'one.csv', createdBy: 'test', createdRole: 'hr-admin' },
          { tenantId: tenantA.id, fileName: 'two.csv', createdBy: 'test', createdRole: 'hr-admin' },
        ],
      }),
    );
  });

  afterAll(async () => {
    await owner.attendanceImport.deleteMany({ where: { tenantId: tenantA.id } });
  });

  it('is every row when it stands alone', async () => {
    const all = await withTenant(runtime, tenantA.id, (tx) => tx.attendanceImport.count());
    const empty = await withTenant(runtime, tenantA.id, (tx) =>
      tx.attendanceImport.count({ where: {} }),
    );
    const emptyRelation = await withTenant(runtime, tenantA.id, (tx) =>
      tx.attendanceImport.count({ where: { tenant: {} } }),
    );

    expect(all).toBe(2);
    expect(empty, 'an empty where is no filter').toBe(2);
    expect(emptyRelation, 'an empty relation filter on its own is no filter either').toBe(2);
  });

  it('is nothing at all inside an OR, which is the trap', async () => {
    // "Either anything, or nothing" should be everything. It is not: the empty
    // branch drops out, and the OR becomes only its other half.
    const either = await withTenant(runtime, tenantA.id, (tx) =>
      tx.attendanceImport.count({ where: { OR: [{}, { fileName: 'one.csv' }] } }),
    );

    expect(either, 'an empty OR branch contributes nothing').toBe(1);
  });

  it('is written by saying what is meant, which costs nothing', async () => {
    // Either spell the branch out...
    const spelled = await withTenant(runtime, tenantA.id, (tx) =>
      tx.attendanceImport.count({
        where: { OR: [{ fileName: { not: '' } }, { fileName: 'one.csv' }] },
      }),
    );

    expect(spelled).toBe(2);

    // ...or, as the exceptions list does now, leave the filter out entirely
    // when there is nothing to narrow by.
    const unfiltered = await withTenant(runtime, tenantA.id, (tx) =>
      tx.attendanceImport.count({ where: {} }),
    );

    expect(unfiltered).toBe(2);
  });
});
