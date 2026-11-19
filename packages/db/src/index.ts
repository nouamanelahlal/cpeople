export { createPrismaClient } from './client.js';
export type { CPeoplePrismaClient } from './client.js';
export { LOCAL_DEV_DATABASE_URL, resolveDatabaseUrl } from './database-url.js';
export { APP_DB_ROLE, TENANT_SETTING, withTenant } from './tenant.js';
export type { TenantClient } from './tenant.js';
export type { Company, Tenant } from './generated/prisma/client.js';
