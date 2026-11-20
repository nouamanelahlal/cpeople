import { execFileSync } from 'node:child_process';

/**
 * Puts the fake users into their organisations before the suite runs.
 *
 * Organisation membership is environment data, so it is not in the realm import;
 * without this the sign-in tests would reach a user whose token carries no tenant.
 * It is idempotent, so running the suite again is free.
 */
export default function globalSetup(): void {
  try {
    // Playwright is always started from the repository root, by `pnpm e2e`.
    execFileSync(process.execPath, ['infra/keycloak/local-dev/join-organisations.mjs'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: { ...process.env, CPEOPLE_LOCAL_DEV: 'true' },
    });
  } catch (error) {
    throw new Error(
      'Could not prepare the Keycloak test users. Is the local stack up?\n' +
        '  docker compose -f infra/docker/docker-compose.yml up -d',
      { cause: error },
    );
  }
}
