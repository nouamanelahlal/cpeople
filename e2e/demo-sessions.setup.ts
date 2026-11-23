import { test as setup } from '@playwright/test';
import { saveSession } from './support/demo-users';

/**
 * Signs the demo's named people in, once, before anything else runs.
 *
 * Several files read the app as Salma, Rachid, Karim and Amina. Left to themselves they
 * would each sign the same people in, and in parallel: two workers asking
 * Keycloak for the same account at the same moment is a race, and the
 * authenticator code the senior roles need cannot be used twice. So it happens
 * here, in one place, before the workers start — and the saved sessions are good
 * for the whole run.
 */
setup('sign the demo people in', async ({ browser }) => {
  setup.setTimeout(240_000);

  for (const role of ['hr', 'manager', 'employee', 'admin'] as const) {
    await saveSession(browser, role);
  }
});
