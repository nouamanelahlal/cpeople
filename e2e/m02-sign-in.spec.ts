import { expect, test } from '@playwright/test';
import {
  clearLockout,
  clearMailbox,
  errorMessage,
  startSignIn,
  submitCode,
  submitEmail,
  submitPassword,
  TEST_PASSWORD,
  USERS,
  waitForEmail,
} from './support/sign-in';

// M02 / HR-08 sign-in. Runs against the local Keycloak realm from
// infra/keycloak/import/cpeople-realm.json, started by the Docker stack.

// Failed attempts are counted server-side and outlive a test run, so the two tests
// that deliberately get a password wrong each own a user and clear its count either
// side. Clearing them all in a hook would not do: hooks run per worker, and one
// worker would reset the count another was busy building up.

test.describe('M02 sign-in', () => {
  test('signs in with email then password, and shows who is signed in', async ({ page }) => {
    await startSignIn(page);

    // Email first: this page asks for an address and nothing else.
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toHaveCount(0);
    await submitEmail(page, USERS.employee.email);
    await submitPassword(page, TEST_PASSWORD);

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('heading')).toContainText(USERS.employee.name);
  });

  test('refuses a wrong password and does not sign anyone in', async ({ page }) => {
    await clearLockout(USERS.wrongPassword.email);
    await startSignIn(page);

    await submitEmail(page, USERS.wrongPassword.email);
    await submitPassword(page, 'not-the-right-password');

    await expect(errorMessage(page)).toContainText(/invalid|incorrect|identifiant/i);
    await expect(page).not.toHaveURL(/\/home$/);

    // And the protected page is still out of reach.
    await page.goto('/home');
    await expect(page).not.toHaveURL(/\/home$/);

    // This test exists to fail a password, so it clears its own mark.
    await clearLockout(USERS.wrongPassword.email);
  });

  test('asks the payroll role for an authenticator code', async ({ page }) => {
    await startSignIn(page);

    await submitEmail(page, USERS.payroll.email);
    await submitPassword(page, TEST_PASSWORD);

    // The password alone is not enough for someone who can move money.
    await expect(page).not.toHaveURL(/\/home$/);
    await expect(page.locator('#otp')).toBeVisible();

    await submitCode(page, USERS.payroll.otpSecret);

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('heading')).toContainText(USERS.payroll.name);
    await expect(page.getByText('payroll-manager')).toBeVisible();
  });

  test('does not ask an employee for a code', async ({ page }) => {
    await startSignIn(page);

    await submitEmail(page, USERS.employee.email);
    await submitPassword(page, TEST_PASSWORD);

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.locator('#otp')).toHaveCount(0);
  });

  test('sends a password-reset e-mail', async ({ page }) => {
    await clearMailbox();

    await startSignIn(page);
    await submitEmail(page, USERS.manager.email);

    await page.locator('a[href*="reset-credentials"]').click();
    await page.locator('#kc-form-login input[type="submit"], #kc-login, button[type="submit"], input[type="submit"]').first().click();

    const email = await waitForEmail(USERS.manager.email);
    expect(email.subject).toMatch(/reset|réinitialis/i);
    // The link is what makes the e-mail useful; without it the flow is broken.
    expect(email.body).toMatch(/login-actions\/action-token|reset-credentials/);
  });
});

test.describe('M02 sign-in lockout', () => {
  // Brute-force counters are per user and shared across browsers, so this one runs
  // on its own and tidies up after itself.
  test.describe.configure({ mode: 'serial' });

  test('locks an account after repeated wrong passwords', async ({ page }, testInfo) => {
    // One browser is enough: the lockout is server-side state, not a rendering concern,
    // and the counter is shared, so running it per project would fight itself.
    test.skip(testInfo.project.name !== 'desktop-chromium');
    // Six full sign-in rounds, each a real browser trip through Keycloak.
    test.slow();

    const { email } = USERS.lockout;
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

      await expect(errorMessage(page)).toContainText(
        /invalid|disabled|temporarily|désactivé|invalide/i,
      );
      await expect(page.locator('#password')).toHaveCount(0);
      await expect(page).not.toHaveURL(/\/home$/);
    } finally {
      await clearLockout(email);
    }
  });
});
