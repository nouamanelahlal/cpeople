// Gives the runtime role a password on a local throwaway database, so the API can
// connect as cpeople_app rather than as the owner.
//
// Local development and CI only: it refuses to run anywhere else. A deployed
// environment provisions its own credentials and passes them in DATABASE_URL, which
// is why no password for a real environment is ever committed here.

import { Client } from 'pg';

const LOCAL_DEV_PASSWORD = 'cpeople_app_dev';

if (process.env.CPEOPLE_LOCAL_DEV !== 'true') {
  console.error(
    'local-dev-role: refusing to run without CPEOPLE_LOCAL_DEV=true.\n' +
      'Deployed environments provision the cpeople_app credentials themselves.',
  );
  process.exit(1);
}

const connectionString =
  process.env.MIGRATION_DATABASE_URL?.trim() ||
  'postgresql://cpeople:cpeople_dev@localhost:5432/cpeople';

const client = new Client({ connectionString });

try {
  await client.connect();
  // The role itself is created by the migrations; this only makes it usable locally.
  await client.query(`ALTER ROLE cpeople_app LOGIN PASSWORD '${LOCAL_DEV_PASSWORD}'`);
  console.log('local-dev-role: cpeople_app can now log in (local development only)');
} catch (error) {
  console.error(
    'local-dev-role: could not prepare the runtime role. Have the migrations run?\n' +
      '  pnpm db:migrate',
  );
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}
