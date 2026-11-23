import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { resolveMigrationDatabaseUrl } from './src/database-url.js';

// `prisma generate` does not connect to anything, so it must keep working without a
// database URL (CI builds, Docker image builds). The commands that do connect fail
// on their own, with Prisma's own message, when the URL is missing.
function datasourceUrl(): string | undefined {
  try {
    return resolveMigrationDatabaseUrl();
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
    // The Prisma CLI connects as the database owner: it is the only thing allowed
    // to change the schema and to provision tenants. The API connects as
    // cpeople_app, through DATABASE_URL, and never reaches this.
    url: datasourceUrl(),
  },
});
