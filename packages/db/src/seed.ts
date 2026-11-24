// Seed for local development. FAKE DATA ONLY (CLAUDE.md rule 6): never put real
// employee, salary or bank data in this file.
//
// Runs as the database owner, which bypasses the row-level-security policies, so it
// can provision tenants. Application code cannot do this.

import { createMigrationPrismaClient } from './client.js';
import { DEMO_TODAY, seedHr01Demo } from './demo/hr01.js';

const prisma = createMigrationPrismaClient();

/**
 * The demo tenants have fixed ids because the Keycloak realm carries them: each
 * organisation in infra/keycloak/import/cpeople-realm.json has a `tenantId`
 * attribute, and that is what the API reads out of the token (M02 / M21). Change
 * one and you must change the other.
 */
const DEMO_TENANT_IDS = {
  'smg-demo': '0193c0de-0000-7000-8000-000000000001',
  'atlas-demo': '0193c0de-0000-7000-8000-000000000002',
} as const;

async function main(): Promise<void> {
  const tenants = [
    {
      id: DEMO_TENANT_IDS['smg-demo'],
      slug: 'smg-demo',
      name: 'SMG Demo',
      countryCode: 'MA',
      company: { name: 'SMG Demo Morocco', legalName: 'SMG Demo Morocco SARL', defaultCurrency: 'MAD' },
    },
    {
      // A second tenant, so tenant isolation is visible while developing.
      id: DEMO_TENANT_IDS['atlas-demo'],
      slug: 'atlas-demo',
      name: 'Atlas Demo',
      countryCode: 'MA',
      company: { name: 'Atlas Demo Retail', legalName: 'Atlas Demo Retail SARL', defaultCurrency: 'MAD' },
    },
  ];

  for (const { company, ...tenant } of tenants) {
    const row = await prisma.tenant.upsert({
      where: { slug: tenant.slug },
      update: { id: tenant.id, name: tenant.name, countryCode: tenant.countryCode },
      create: tenant,
    });

    await prisma.company.upsert({
      where: { tenantId_name: { tenantId: row.id, name: company.name } },
      update: { legalName: company.legalName, defaultCurrency: company.defaultCurrency },
      create: { ...company, tenantId: row.id },
    });

    console.log(`seeded tenant ${row.slug} (${row.id})`);

    // The HR-01 demo lives in the SMG tenant only: the second tenant exists to
    // prove isolation, and an empty one proves it better.
    if (row.slug === 'smg-demo') {
      const company = await prisma.company.findFirstOrThrow({ where: { tenantId: row.id } });
      const counts = await seedHr01Demo(prisma, row.id, company.id);
      console.log(
        `  HR-01 demo (as at ${DEMO_TODAY}): ${counts.employees} employees, ` +
          `${counts.contracts} contracts, ${counts.documents} documents, ${counts.tasks} onboarding tasks`,
      );
      console.log(
        `  HR-02 leave set-up: ${counts.leave.leaveTypes} leave types, ` +
          `${counts.leave.leaveRules} rules, ${counts.leave.workWeeks} working weeks, ` +
          `${counts.leave.holidays} public holidays — all marked to be confirmed`,
      );
      console.log(
        `  HR-02 leave requests: ${counts.leaveRequests.requests} requests, ` +
          `${counts.leaveRequests.pending} of them waiting on somebody`,
      );
      console.log(
        `  HR-02 balances: ${counts.balances.openingBalances} opening balances, ` +
          `${counts.balances.adjustments} adjustments, ` +
          `${counts.balances.payrollMonths} payroll months (October locked, November open)`,
      );
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
