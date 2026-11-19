import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { resolveDatabaseUrl } from './src/database-url.js';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // The Prisma CLI connects as the database owner, which is allowed to run
    // migrations and to provision tenants. The API connects through
    // withTenant(), which drops to the unprivileged cpeople_app role.
    url: resolveDatabaseUrl(),
  },
});
