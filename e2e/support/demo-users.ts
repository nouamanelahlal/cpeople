import { expect, type Browser, type Page } from '@playwright/test';
import {
  dismissWelcome,
  startSignIn,
  submitCode,
  submitEmail,
  submitPassword,
  TEST_PASSWORD,
} from './sign-in';

/**
 * The demo's named cast (HR-01 spec section 4), as Keycloak holds them.
 *
 * These are the people a workshop is shown: one per role, each a real account
 * with a real password, because the demo's claim is that the roles are enforced
 * and not drawn. They are invented, they live only in
 * infra/keycloak/import-local-dev, and their employee files come from the
 * deterministic seed in packages/db/src/demo/hr01.ts, matched on e-mail.
 *
 * The two senior roles hold `mfa-required`, so signing in as them takes an
 * authenticator code; the shared secret below is the one the local-dev import
 * gives them.
 */
export const DEMO_USERS = {
  admin: {
    email: 'admin@smg-demo.test',
    name: 'Amina Admin',
    firstName: 'Amina',
    otpSecret: 'cpeople-test-admin-secret',
  },
  hr: {
    email: 'hr@smg-demo.test',
    name: 'Salma Benali',
    firstName: 'Salma',
    otpSecret: 'cpeople-test-hr-secret',
  },
  manager: {
    email: 'manager@smg-demo.test',
    name: 'Rachid Kettani',
    firstName: 'Rachid',
  },
  employee: {
    email: 'employee@smg-demo.test',
    name: 'Karim Alaoui',
    firstName: 'Karim',
  },
} as const;

export type DemoRole = keyof typeof DEMO_USERS;

/**
 * Signs in as one of them and lands on the home screen, animation out of the way.
 *
 * The real thing: Keycloak's pages, the password, the code where the role takes
 * one, and the session cookie the app sets. Nothing here can grant a role the
 * token does not carry, which is the point of demonstrating it this way.
 */
export async function signInAs(page: Page, role: DemoRole): Promise<void> {
  const user = DEMO_USERS[role];

  await startSignIn(page);
  await submitEmail(page, user.email);
  await submitPassword(page, TEST_PASSWORD);

  if ('otpSecret' in user) {
    await submitCode(page, user.otpSecret);
  }

  await expect(page).toHaveURL(/\/home$/, { timeout: 20_000 });
  await dismissWelcome(page);
}

/**
 * Reads the app in English, whichever language the account prefers.
 *
 * Salma's and Karim's accounts are French, as an HR team in Casablanca would
 * have them, and the top bar's toggle is named in the language it switches to.
 * Both languages are examined in e2e/home.spec.ts; a test about figures should
 * not also be a test about translation.
 */
export async function useEnglish(page: Page): Promise<void> {
  const toEnglish = page.getByRole('button', { name: /^(Langue : English|Language: English)$/ });

  if ((await toEnglish.count()) > 0) {
    await toEnglish.click();
    await expect(page.getByRole('button', { name: 'Language: Français' })).toBeVisible();
  }
}

/**
 * Where a role's signed-in session is kept between tests.
 *
 * Signing in again for every test does not work and would not be worth the time
 * if it did: an authenticator code lasts thirty seconds and cannot be used
 * twice, so the senior roles can only sign in once in a while. A test file signs
 * each person in once and reads the app as them from there.
 */
export function sessionPath(role: DemoRole): string {
  return `.auth/hr01-${role}.json`;
}

/** Signs one of them in, once, and keeps the session for the rest of the file. */
export async function saveSession(browser: Browser, role: DemoRole): Promise<void> {
  const context = await browser.newContext({ timezoneId: 'Africa/Casablanca' });
  const page = await context.newPage();

  await signInAs(page, role);
  await context.storageState({ path: sessionPath(role) });
  await context.close();
}

/**
 * A page of the app, read as one of the demo's people.
 *
 * The session comes from `saveSession`, so a file signs each person in once and
 * then opens as many pages as it likes as them. Each page gets its own context,
 * which is what keeps one test's filters, language and menu out of the next.
 */
export async function openAs(
  browser: Browser,
  role: DemoRole,
  options: { path?: string; viewport?: { width: number; height: number } } = {},
): Promise<Page> {
  const context = await browser.newContext({
    timezoneId: 'Africa/Casablanca',
    storageState: sessionPath(role),
    ...(options.viewport ? { viewport: options.viewport } : {}),
  });
  const page = await context.newPage();

  await page.goto(options.path ?? '/home');
  await expect(page.locator('h1')).toBeVisible();

  return page;
}
