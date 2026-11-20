import { expect, test, type Page } from '@playwright/test';
import {
  chooseLanguage,
  clearLockout,
  clearMailbox,
  errorMessage,
  startSignIn,
  submitCode,
  submitEmail,
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

    // Email first: this page asks for an address and nothing else.
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toHaveCount(0);
    await submitEmail(page, users.employee.email);
    await submitPassword(page, TEST_PASSWORD);

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('heading')).toContainText(users.employee.name);
  });

  test('refuses a wrong password and does not sign anyone in', async ({ page }) => {
    await clearLockout(users.wrongPassword.email);
    await startSignIn(page);

    await submitEmail(page, users.wrongPassword.email);
    await submitPassword(page, 'not-the-right-password');

    await expect(errorMessage(page)).toContainText(/match|correspond/i);
    await expect(page).not.toHaveURL(/\/home$/);

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
    await expect(page.getByRole('heading')).toContainText(users.payroll.name);
    await expect(page.getByText('payroll-manager')).toBeVisible();
  });

  test('does not ask an employee for a code', async ({ page }) => {
    await startSignIn(page);

    await submitEmail(page, users.employee.email);
    await submitPassword(page, TEST_PASSWORD);

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.locator('#otp')).toHaveCount(0);
  });

  test('sends a password-reset e-mail and says so', async ({ page }) => {
    await clearMailbox();

    await startSignIn(page);
    await submitEmail(page, users.employee.email);

    await page.locator('a[href*="reset-credentials"]').click();
    await page.locator('#username').waitFor({ state: 'visible' });
    await page.locator('button[type="submit"], input[type="submit"]').first().click();

    // The screen says what happened, in the CPeople theme rather than Keycloak's.
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /check your inbox|boîte mail/i,
    );

    const email = await waitForEmail(users.employee.email);
    expect(email.subject).toMatch(/CPeople/);
    expect(email.body).toMatch(/login-actions\/action-token|reset-credentials/);
  });
});

test.describe('M02 sign-in lockout', () => {
  test.describe.configure({ mode: 'serial' });

  test('locks an account after repeated wrong passwords', async ({ page }) => {
    // Six full sign-in rounds, each a real browser trip through Keycloak.
    test.slow();

    const { email } = users.lockout;
    await clearLockout(email);

    try {
      // The realm locks after 5 failures.
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        await startSignIn(page);
        await submitEmail(page, email);
        await submitPassword(page, `wrong-password-${attempt}`);
      }

      // Now the account is locked, and the right password gets no further: the
      // lockout is applied at the email step, before a password is even asked for.
      await startSignIn(page);
      await submitEmail(page, email);

      await expect(errorMessage(page)).toContainText(/locked|bloqué|match|correspond/i);
      await expect(page.locator('#password')).toHaveCount(0);
      await expect(page).not.toHaveURL(/\/home$/);
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
    await expect(page.getByRole('heading')).toContainText(users.employee.name);
  });

  test('signing out ends the Keycloak session, not just this one', async ({ page }) => {
    await signIn(page, users);

    await page.getByRole('button', { name: /sign out|se déconnecter/i }).click();
    await expect(page).toHaveURL(/\/signed-out$/);

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
    await expect(page.getByRole('heading')).toContainText(`Bon retour, ${users.payroll.name}`);
    await expect(page.getByRole('button', { name: /se déconnecter/i })).toBeVisible();
  });
});

async function signIn(page: Page, projectUsers: ProjectUsers): Promise<void> {
  await startSignIn(page);
  await submitEmail(page, projectUsers.employee.email);
  await submitPassword(page, TEST_PASSWORD);
  await expect(page).toHaveURL(/\/home$/);
}
