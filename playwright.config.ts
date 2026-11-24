import { defineConfig, devices } from '@playwright/test';

// End-to-end tests for CPeople. Runs against the local web app (apps/web).
// Fake data only: never point these tests at Test or Prod with real employee data.
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // A sign-in test is several real browser round trips through Keycloak, and a
  // development build compiles each page the first time it is asked for, so the
  // first test to reach a screen pays for it.
  timeout: 120_000,
  fullyParallel: true,
  /*
   * One worker, on purpose.
   *
   * The suite drives one application against one demo database, and the HR-01
   * tests change it: they hire people, upload documents, sign contracts and
   * renew fixed terms. Run in parallel, a test that asserts "148 employees" is
   * racing another that has just created the 149th — and the figures are the
   * point of a demo, so they are asserted rather than observed.
   *
   * Everything is therefore ordered: the demo data is reseeded once before the
   * run (e2e/global-setup.ts), and the files go one after another.
   */
  workers: 1,
  // How long one expectation waits. The default five seconds is a guess about a
  // built application; this suite drives a development build, where the first
  // request for a page compiles it. A real failure still fails — a little later.
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  // One retry locally, two in CI. This suite drives a development build, where
  // the first request for a page compiles it and a cold page can take longer
  // than the test allows — noise, not a defect. A test that fails twice is
  // still a failure, so nothing real is hidden by this.
  retries: process.env.CI ? 2 : 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Signs the demo's named people in before the suite starts; see
    // e2e/demo-sessions.setup.ts for why that cannot be left to the files.
    { name: 'demo-sessions', testMatch: /demo-sessions\.setup\.ts/ },
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      dependencies: ['demo-sessions'],
    },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'desktop-fr', use: { ...devices['Desktop Chrome'], locale: 'fr-MA' } },
  ],
  // Starts both halves of the app. The home screen's figures come from the API,
  // so a run without it would be testing a page that says its data is missing.
  // Through turbo, so the workspace packages they import are built first:
  // @cpeople/shared and @cpeople/db ship compiled output.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: 'pnpm exec turbo run dev --filter=web',
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          // Errors only. A page that could not reach the API says so on the
          // server and draws its empty state in the browser, and a test that
          // fails on a missing figure should not leave us guessing why.
          stderr: 'pipe',
        },
        {
          command: 'pnpm exec turbo run dev --filter=api',
          url: 'http://localhost:3100/api/health',
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          stderr: 'pipe',
        },
      ],
});
