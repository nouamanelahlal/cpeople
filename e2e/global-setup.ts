import { execFileSync } from 'node:child_process';

/**
 * Puts the suite's world back where it started, before anything runs.
 *
 * Two things, both idempotent, both cheap enough to do every time:
 *
 *  - the fake users join their organisations. Membership is environment data, so
 *    it is not in the realm import; without it the sign-in tests reach a user
 *    whose token carries no tenant.
 *  - the demo data is re-seeded. The HR-01 tests hire people, sign contracts,
 *    renew fixed terms and upload documents — they are tests of a demo, and a
 *    demo is meant to be reset. Starting every run from the same 44 people is
 *    what lets them assert figures instead of observing them, and it is the
 *    spec's own first smoke-test step ("Reset demo data").
 */
export default function globalSetup(): void {
  run('infra/keycloak/local-dev/join-organisations.mjs', 'Could not prepare the Keycloak test users.');
  seed();
}

function run(script: string, whenItFails: string): void {
  try {
    // Playwright is always started from the repository root, by `pnpm e2e`.
    execFileSync(process.execPath, [script], {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: { ...process.env, CPEOPLE_LOCAL_DEV: 'true' },
    });
  } catch (error) {
    throw new Error(
      `${whenItFails}\nIs the local stack up?\n` +
        '  docker compose -f infra/docker/docker-compose.yml up -d',
      { cause: error },
    );
  }
}

function seed(): void {
  try {
    execFileSync('pnpm', ['--silent', '--filter', '@cpeople/db', 'run', 'seed'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, CPEOPLE_LOCAL_DEV: 'true' },
    });
  } catch (error) {
    throw new Error(
      'Could not reseed the demo data. Is Postgres up, and has the schema been created?\n' +
        '  docker compose -f infra/docker/docker-compose.yml up -d\n' +
        '  pnpm db:deploy',
      { cause: error },
    );
  }
}
