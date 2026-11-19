import { execSync } from 'node:child_process';
import * as path from 'node:path';

const packageRoot = path.resolve(import.meta.dirname, '..');

/**
 * Applies the migrations before the suite runs, so the policies under test are the
 * ones in prisma/migrations and not something left over in a developer's database.
 */
export default function setup(): void {
  try {
    execSync('pnpm exec prisma migrate deploy', { cwd: packageRoot, stdio: 'inherit' });
    // The suite connects as cpeople_app, the way the API does, so the role needs a
    // password on this throwaway database.
    execSync('node scripts/local-dev-role.mjs', { cwd: packageRoot, stdio: 'inherit' });
  } catch (error) {
    throw new Error(
      'Could not prepare the test database. Two usual reasons:\n' +
        '  - the local stack is down:\n' +
        '      docker compose -f infra/docker/docker-compose.yml up -d\n' +
        '  - vitest was started directly, so CPEOPLE_LOCAL_DEV is not set and there is\n' +
        '    no migration URL to use. Run the suite with `pnpm test`.',
      { cause: error },
    );
  }
}
