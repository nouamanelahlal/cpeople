import { statSync } from 'node:fs';
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

  // The code step only when the realm asks for one. A workshop runs with
  // two-step sign-in switched off (pnpm demo:prepare), and the suite has to
  // work either way rather than assuming which it is.
  if ('otpSecret' in user && (await page.locator('#otp').count()) > 0) {
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
  // The sign-in page has a language button of its own, so a session that has
  // expired by the time this runs would otherwise end in twenty seconds of
  // waiting for a button that was never coming, and a failure that talks about
  // translation rather than about the session. Say what actually happened.
  if (/\/realms\//.test(page.url())) {
    throw new Error(
      `Signed out before the test began: the page is Keycloak's sign-in, not the app (${page.url()}). ` +
        'A stored session expired or the realm was restarted; run the suite again.',
    );
  }

  const toEnglish = page.getByRole('button', { name: /^(Langue : English|Language: English)$/ });

  if ((await toEnglish.count()) > 0) {
    await toEnglish.click();
    // A language change is a round trip to the server and back to the page you
    // were reading, which on a development build may be compiling it as it goes.
    await expect(page.getByRole('button', { name: 'Language: Français' })).toBeVisible({
      timeout: 20_000,
    });
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

/**
 * How long a saved session is reused before someone signs in again.
 *
 * Keycloak forgets an **idle** session after thirty minutes, and every sign-in
 * costs a round trip through three pages — two of them with an authenticator
 * code that cannot be used twice. So a session is kept and shared, but not
 * forever: fifteen minutes leaves half the realm's patience in hand, which a
 * single slow test cannot eat through.
 *
 * This window only means anything because `openAs` consults it. Signing
 * everybody in once before the run and never looking again is what let a
 * session quietly age past thirty minutes in the middle of a suite that now
 * takes nearly half an hour — the failure landed on whichever test happened to
 * be running, complaining about a language button, which is a long way from the
 * truth.
 */
const SESSION_MINUTES = 15;

/**
 * Makes sure there is a session for one of them, signing in only when there is
 * not one to hand. Files that each want the same person therefore sign in once
 * between them, not once each.
 */
export async function saveSession(
  browser: Browser,
  role: DemoRole,
  options: { force?: boolean } = {},
): Promise<void> {
  const path = sessionPath(role);

  try {
    const age = Date.now() - statSync(path).mtimeMs;
    if (!options.force && age < SESSION_MINUTES * 60_000) {
      return;
    }
  } catch {
    // No session yet: sign in.
  }

  const context = await browser.newContext({ timezoneId: 'Africa/Casablanca' });
  const page = await context.newPage();

  await signInAs(page, role);
  await context.storageState({ path });
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
  // Before the session is used, not only before the run: a suite that takes
  // half an hour outlives a session that the realm forgets after thirty idle
  // minutes. This signs in again when the stored one is getting old, and costs
  // nothing at all when it is not.
  await saveSession(browser, role);

  const open = async (): Promise<Page> => {
    const context = await browser.newContext({
      timezoneId: 'Africa/Casablanca',
      storageState: sessionPath(role),
      ...(options.viewport ? { viewport: options.viewport } : {}),
    });
    const page = await context.newPage();

    await page.goto(options.path ?? '/home');
    return page;
  };

  let page = await open();

  // And if the session turned out to be dead anyway — the realm restarted, say,
  // which ends every session it had — sign in once more rather than failing the
  // test that happened to be next. A second refusal is a real problem and is
  // left to fail.
  if (signedOut(page)) {
    await page.context().close();
    await saveSession(browser, role, { force: true });
    page = await open();
  }

  await expect(page.locator('h1')).toBeVisible();

  return page;
}

/** Whether a page is Keycloak's sign-in rather than the app. */
function signedOut(page: Page): boolean {
  return /\/realms\//.test(page.url());
}
