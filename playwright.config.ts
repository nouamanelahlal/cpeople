import { defineConfig, devices } from '@playwright/test';

// End-to-end tests for CPeople. Runs against the local web app (apps/web).
// Fake data only: never point these tests at Test or Prod with real employee data.
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // A sign-in test is several real browser round trips through Keycloak, and the
  // dev server compiles routes the first time each is asked for. 30s is too tight
  // once three browser projects run at once.
  timeout: 60_000,
  fullyParallel: true,
  // How long one expectation waits. The default five seconds is a guess about a
  // built application; this suite drives a development build, where the first
  // request for a page compiles it and several workers ask at once. A real
  // failure still fails — a little later.
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
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
