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
  } catch (error) {
    throw new Error(
      'Could not apply the migrations. Is the local stack up?\n' +
        '  docker compose -f infra/docker/docker-compose.yml up -d',
      { cause: error },
    );
  }
}
