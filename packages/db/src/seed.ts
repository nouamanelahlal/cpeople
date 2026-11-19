// Seed for local development. FAKE DATA ONLY (CLAUDE.md rule 6): never put real
// employee, salary or bank data in this file.
//
// Runs as the database owner, which bypasses the row-level-security policies, so it
// can provision tenants. Application code cannot do this.

import { createPrismaClient } from './client.js';

const prisma = createPrismaClient();

async function main(): Promise<void> {
  const tenants = [
    {
      slug: 'smg-demo',
      name: 'SMG Demo',
      countryCode: 'MA',
      company: { name: 'SMG Demo Morocco', legalName: 'SMG Demo Morocco SARL', defaultCurrency: 'MAD' },
    },
    {
      // A second tenant, so tenant isolation is visible while developing.
      slug: 'atlas-demo',
      name: 'Atlas Demo',
      countryCode: 'MA',
      company: { name: 'Atlas Demo Retail', legalName: 'Atlas Demo Retail SARL', defaultCurrency: 'MAD' },
    },
  ];

  for (const { company, ...tenant } of tenants) {
    const row = await prisma.tenant.upsert({
      where: { slug: tenant.slug },
      update: { name: tenant.name, countryCode: tenant.countryCode },
      create: tenant,
    });

    await prisma.company.upsert({
      where: { tenantId_name: { tenantId: row.id, name: company.name } },
      update: { legalName: company.legalName, defaultCurrency: company.defaultCurrency },
      create: { ...company, tenantId: row.id },
    });

    console.log(`seeded tenant ${row.slug} (${row.id})`);
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
