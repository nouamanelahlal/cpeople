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
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'desktop-fr', use: { ...devices['Desktop Chrome'], locale: 'fr-MA' } },
  ],
  // Starts the web app automatically once apps/web is scaffolded.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm --filter web dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
