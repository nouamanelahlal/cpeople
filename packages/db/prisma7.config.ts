import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { resolveDatabaseUrl } from './src/database-url.js';

// `prisma generate` does not connect to anything, so it must keep working without a
// database URL (CI builds, Docker image builds). The commands that do connect fail
// on their own, with Prisma's own message, when the URL is missing.
function datasourceUrl(): string | undefined {
  try {
    return resolveDatabaseUrl();
  } catch {
    return undefined;
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // The Prisma CLI connects as the database owner, which is allowed to run
    // migrations and to provision tenants. The API connects through
    // withTenant(), which drops to the unprivileged cpeople_app role.
    url: datasourceUrl(),
  },
});
