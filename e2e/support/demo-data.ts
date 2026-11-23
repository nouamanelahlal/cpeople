import { execFileSync } from 'node:child_process';

/**
 * Puts the demo company back exactly as it is seeded.
 *
 * The HR-01 tests change the data they read: they hire people, upload
 * documents, sign contracts and renew fixed terms. The figures are the point of
 * this demo — 148 employees, 12 fixed terms, 5 documents running out — so the
 * tests that assert them start from the seed rather than from whatever the last
 * file left behind.
 *
 * Deterministic and quick (a few seconds). The suite runs one file at a time,
 * so no two of these can collide.
 *
 * It runs the seed that is already built, deliberately: rebuilding the package
 * rewrites `@cpeople/db/dist`, the API's watcher sees it and restarts, and the
 * next page in the test finds nothing listening. The global setup builds it
 * once, before anything is running.
 */
export function resetDemoData(): void {
  try {
    execFileSync('pnpm', ['--silent', '--filter', '@cpeople/db', 'run', 'seed:built'], {
      cwd: process.cwd(),
      stdio: 'ignore',
      shell: process.platform === 'win32',
      env: { ...process.env, CPEOPLE_LOCAL_DEV: 'true' },
    });
  } catch (error) {
    throw new Error('Could not reset the demo data. Is Postgres up?', { cause: error });
  }
}
