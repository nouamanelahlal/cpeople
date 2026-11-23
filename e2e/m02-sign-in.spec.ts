import { expect, test, type Page } from '@playwright/test';
import {
  accountButton,
  chooseLanguage,
  clearLockout,
  dismissWelcome,
  errorMessage,
  KEYCLOAK_URL,
  openAccountMenu,
  startSignIn,
  submitCode,
  submitEmail,
  signOutFromMenu,
  submitPassword,
  TEST_PASSWORD,
  usersFor,
  waitForEmail,
  type ProjectUsers,
} from './support/sign-in';

// M02 / HR-08 sign-in, against the local Keycloak realm from
// infra/keycloak/import/cpeople-realm.json with the CPeople theme
// (packages/keycloak-theme) on top.
//
// Every project runs the whole flow: desktop, phone size, and French. They do not
// tread on each other because each has its own fake users — sign-in state lives in
// Keycloak, and sharing a user would mean sharing failed-attempt counts, single-use
// authenticator codes and the guard against repeated sign-ins within a second.

let users: ProjectUsers;

// Playwright wants a destructuring pattern here even when nothing is needed from it.
test.beforeEach(({ browserName: _browserName }, testInfo) => {
  users = usersFor(testInfo.project.name);
});

test.describe('M02 sign-in', () => {
  test('signs in with email then password, and shows who is signed in', async ({ page }) => {
    await startSignIn(page);

    // Email first: the page asks for an address and shows nothing else. The
    // password field is in the form all along, because both travel together, but it
    // is out of sight and out of the way until the address is in.
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).not.toBeVisible();
    await submitEmail(page, users.employee.email);
    await submitPassword(page, TEST_PASSWORD);

    await expect(page).toHaveURL(/\/home$/);
    await expect(accountButton(page, users.employee.name)).toBeVisible();
  });

  test('refuses a wrong password and does not sign anyone in', async ({ page }) => {
    await clearLockout(users.wrongPassword.email);
    await startSignIn(page);

    await submitEmail(page, users.wrongPassword.email);
    await submitPassword(page, 'not-the-right-password');

    await expect(errorMessage(page)).toContainText(/match|correspond/i);
    await expect(page).not.toHaveURL(/\/home$/);

    // The message cannot say what went wrong without saying whether the account
    // exists, so under it is the line that helps whatever the case was.
    const help = page.locator('.cp-help');
    await expect(help).toBeVisible();
    await expect(help).toContainText(/HR administrator|responsable RH/i);
    await expect(help.locator('a')).toHaveAttribute('href', /reset-credentials/);

    // And the protected page is still out of reach.
    await page.goto('/home');
    await expect(page).not.toHaveURL(/\/home$/);

    // This test exists to fail a password, so it clears its own mark.
    await clearLockout(users.wrongPassword.email);
  });

  test('asks the payroll role for an authenticator code', async ({ page }) => {
    await startSignIn(page);

    await submitEmail(page, users.payroll.email);
    await submitPassword(page, TEST_PASSWORD);

    // The password alone is not enough for someone who can move money.
    await expect(page).not.toHaveURL(/\/home$/);
    await expect(page.locator('#otp')).toBeVisible();

    await submitCode(page, users.payroll.otpSecret);

    await expect(page).toHaveURL(/\/home$/);
    // Their name, and their job named in words rather than in realm roles.
    await expect(accountButton(page, users.payroll.name)).toContainText(
      /Payroll manager|Responsable paie/,
    );
  });

  test('does not ask an employee for a code', async ({ page }) => {
    await startSignIn(page);

    await submitEmail(page, users.employee.email);
    await submitPassword(page, TEST_PASSWORD);

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.locator('#otp')).toHaveCount(0);
  });

  test('sends a password-reset e-mail and says so', async ({ page }) => {
    // No mailbox clearing anywhere here: every project has its own users, so the
    // recipient and the time are enough to find the right message — and emptying a
    // shared mailbox would delete what another project is waiting for.
    const asked = Date.now();

    await startSignIn(page);
    await submitEmail(page, users.employee.email);

    // The reset page asks for the address itself, as the design has it: the sign-in
    // page never submitted it, so Keycloak has nothing to go on and no chance to
    // skip this screen.
    await page.locator('a[href*="reset-credentials"]').click();
    await page.locator('#username').waitFor({ state: 'visible' });
    await page.locator('#username').fill(users.employee.email);
    await page.locator('button[type="submit"], input[type="submit"]').first().click();

    // Keycloak puts the confirmation back on the sign-in page, which is where the
    // person can now use the link or try again. The wording is ours and it says
    // nothing about whether the address is one we know.
    await expect(errorMessage(page)).toContainText(/on its way|en route/i);

    const email = await waitForEmail(users.employee.email, asked);
    expect(email.subject).toMatch(/CPeople/);
    expect(email.body).toMatch(/login-actions\/action-token|reset-credentials/);
  });
});

test.describe('M02 sign-in tells nobody which addresses exist', () => {
  // The sign-in page shows two steps and makes one submission. That is what keeps
  // it from answering "does this address have an account?": the email step has
  // nothing to ask, and by the time Keycloak hears the address it is hearing the
  // password too, so a wrong password and an address nobody owns come back as the
  // same sentence (infra/keycloak/README.md).

  test('the email step makes no request to Keycloak', async ({ page }) => {
    await startSignIn(page);
    // Let the page finish loading its own assets before watching the wire.
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const toKeycloak: string[] = [];
    page.on('request', (request) => {
      if (request.url().startsWith(KEYCLOAK_URL) && !request.url().includes('/resources/')) {
        toKeycloak.push(`${request.method()} ${request.url()}`);
      }
    });
    const before = page.url();

    await page.locator('#username').fill('someone-nobody-has-ever-heard-of@smg-demo.test');
    await page.locator('button[type="submit"]').first().click();
    await expect(page.locator('#password')).toBeVisible();

    // Nothing left the browser, so there was no answer to read and nothing to
    // time: the address is still the visitor's own business.
    expect(toKeycloak).toEqual([]);
    expect(page.url()).toBe(before);
  });

  test('an unknown email and a real one behave identically up to the password error', async ({
    page,
  }) => {
    const real = users.wrongPassword.email;
    const unknown = `nobody-${users.wrongPassword.email}`;
    await clearLockout(real);

    try {
      const forReal = await attempt(page, real);
      const forUnknown = await attempt(page, unknown);

      // Same screen at the email step, same screen after the password: whichever
      // address was typed, there is nothing in front of the visitor to tell them
      // apart — no different message, no different page, no different field.
      expect(forUnknown).toEqual(forReal);
      expect(forReal.afterPassword.messages.join(' ')).toMatch(/match|correspond/i);
    } finally {
      await clearLockout(real);
    }
  });

  /** Walks one address through both steps and writes down everything on screen. */
  async function attempt(page: Page, email: string) {
    await startSignIn(page);

    await page.locator('#username').fill(email);
    await page.locator('button[type="submit"]').first().click();
    await expect(page.locator('#password')).toBeVisible();
    const afterEmail = await screen(page);

    await submitPassword(page, 'not-the-right-password');
    const afterPassword = await screen(page);

    return { afterEmail, afterPassword };
  }

  /** What a person can see and act on, with the volatile parts left out. */
  async function screen(page: Page) {
    return {
      // The path only: the query carries a session code that differs every time.
      path: new URL(page.url()).pathname,
      heading: (await page.getByRole('heading', { level: 1 }).textContent())?.trim() ?? '',
      messages: (await page.locator('.cp-alert').allTextContents()).map((text) => text.trim()),
      passwordAsked: await page.locator('#password').isVisible(),
      codeAsked: await page.locator('#otp').isVisible(),
      signedIn: /\/home$/.test(page.url()),
    };
  }
});

test.describe('M02 sign-in lockout', () => {
  test.describe.configure({ mode: 'serial' });

  test('locks an account after repeated wrong passwords', async ({ page }) => {
    // Six full sign-in rounds, each a real browser trip through Keycloak.
    test.slow();

    const { email } = users.lockout;
    const started = Date.now();
    await clearLockout(email);

    try {
      // The realm locks after 5 failures.
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        await startSignIn(page);
        await submitEmail(page, email);
        await submitPassword(page, `wrong-password-${attempt}`);
      }

      // Now the account is locked: the right password gets no further.
      //
      // It is refused in the same words as a wrong one, which is Keycloak's own
      // doing and the right answer anyway — "your account is locked" would tell an
      // attacker the address is real, which is exactly what this flow is built not
      // to say. The lock is in the refusal, not in the wording.
      await startSignIn(page);
      await submitEmail(page, email);
      await submitPassword(page, TEST_PASSWORD);

      await expect(errorMessage(page)).toContainText(/match|correspond/i);
      await expect(page).not.toHaveURL(/\/home$/);

      // Still locked out even with the right password, where an unlocked account
      // would now be on /home.
      await page.goto('/home');
      await expect(page).not.toHaveURL(/\/home$/);

      // The owner is told, because the person who meets the lock on screen may not
      // be the person whose account it is. In their language, in our words.
      const notice = await waitForEmail(email, started);
      expect(notice.subject).toMatch(/account is locked|compte CPeople est bloqué/i);
      expect(notice.body).toMatch(
        /locked after several failed sign-in attempts|bloqué après plusieurs tentatives/i,
      );
      expect(notice.body).toMatch(/unlocks automatically|se débloque automatiquement/i);
    } finally {
      await clearLockout(email);
    }
  });
});

test.describe('M02 session handling', () => {
  test('keeps a session alive by refreshing the access token', async ({ page }) => {
    await signIn(page, users);

    // The gate sends people here once their access token runs out. Going straight
    // there exercises the refresh grant without waiting out the token's lifetime.
    await page.goto('/api/auth/refresh?callbackUrl=/home');

    await expect(page).toHaveURL(/\/home$/);
    await expect(accountButton(page, users.employee.name)).toBeVisible();
  });

  test('brings people back to the page they asked for, filters and all', async ({ page }) => {
    await signIn(page, users);

    // A renewed token must not quietly undo what they had asked for: a filtered
    // list, a tab of a file, a page of results. The gate carries the whole
    // address through the detour, not just the path.
    const asked = '/employees?view=documents-expiring&sort=hireDate&dir=desc';
    await page.goto(`/api/auth/refresh?callbackUrl=${encodeURIComponent(asked)}`);

    await expect(page).toHaveURL(
      /\/employees\?view=documents-expiring&sort=hireDate&dir=desc$/,
    );
  });

  test('signing out ends the Keycloak session, not just this one', async ({ page }) => {
    await signIn(page, users);

    await signOutFromMenu(page, users.employee.name);
    // Through Keycloak's logout endpoint and back, which is a round trip.
    await expect(page).toHaveURL(/\/signed-out$/, { timeout: 15_000 });

    // The protected page is closed again.
    await page.goto('/home');
    await expect(page).not.toHaveURL(/\/home$/);

    // And Keycloak asks for the password again rather than waving the next person
    // through on a session the sign-out left open.
    await startSignIn(page);
    await submitEmail(page, users.employee.email);
    await expect(page.locator('#password')).toBeVisible();
  });
});

test.describe('M02 sign-in in French', () => {
  test('runs the whole flow in French and comes back in French', async ({ page }, testInfo) => {
    // The French project's users prefer French in Keycloak, which is what makes
    // this a real French run rather than English pages with a French button.
    test.skip(!testInfo.project.name.endsWith('fr'), 'The French project owns this one.');

    // The e-mail step is the proof that the app passed ui_locales: at that point
    // Keycloak has no idea who is signing in, so the only thing it can go on is
    // what the app told it (M23).
    await chooseLanguage(page, 'Français');
    await page.getByRole('button', { name: /se connecter/i }).click();
    await page.locator('#username').waitFor({ state: 'visible' });

    await expect(page.getByPlaceholder(/adresse e-mail/i)).toBeVisible();
    await submitEmail(page, users.payroll.email);

    await expect(page.getByPlaceholder(/mot de passe/i)).toBeVisible();
    await expect(page.locator('a[href*="reset-credentials"]')).toHaveText(/mot de passe oublié/i);
    await submitPassword(page, TEST_PASSWORD);

    // This user handles pay, so the code step applies in French too.
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/saisissez votre code/i);
    await submitCode(page, users.payroll.otpSecret);

    await expect(page).toHaveURL(/\/home$/);
    // The home screen greets in French, by the time of day: "Bienvenue" belongs to
    // the sign-in page and stays there.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      new RegExp(`^(Bonjour|Bonsoir), ${users.payroll.name.split(' ')[0]}$`),
    );
    // Including the way out, which lives in the account menu.
    await openAccountMenu(page, users.payroll.name);
    await expect(page.getByRole('button', { name: 'Se déconnecter' })).toBeVisible();
  });
});

async function signIn(page: Page, projectUsers: ProjectUsers): Promise<void> {
  await startSignIn(page);
  await submitEmail(page, projectUsers.employee.email);
  await submitPassword(page, TEST_PASSWORD);
  // Keycloak and three redirects, on a machine running the whole suite at once.
  await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
  await dismissWelcome(page);
}
