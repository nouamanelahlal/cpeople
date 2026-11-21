import { createHmac } from 'node:crypto';
import type { Page } from '@playwright/test';

/** The local realm, started by infra/docker/docker-compose.yml. */
export const KEYCLOAK_URL = process.env.E2E_KEYCLOAK_URL ?? 'http://localhost:8080';
export const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025';
export const REALM = 'cpeople';

/** Fake demo users, seeded by the realm import. Fake data only (CLAUDE.md rule 6). */
export const TEST_PASSWORD = 'CPeople-Test-2027!';

/**
 * Each Playwright project gets its own people.
 *
 * Sign-in state lives in Keycloak, not in the browser — failed-attempt counts,
 * single-use authenticator codes, and a guard against the same user signing in
 * repeatedly within a second — so three browsers sharing one user fight over all
 * three. A set each, and the whole flow can run on every project at once.
 *
 * The `fr` set prefers French in Keycloak, which is what makes the French run a
 * real one rather than English pages with a French button.
 */
export type ProjectUsers = {
  readonly employee: { readonly email: string; readonly name: string };
  readonly payroll: { readonly email: string; readonly name: string; readonly otpSecret: string };
  readonly wrongPassword: { readonly email: string };
  readonly lockout: { readonly email: string };
};

function slugFor(projectName: string): 'desktop' | 'mobile' | 'fr' {
  if (projectName.startsWith('mobile')) return 'mobile';
  if (projectName.endsWith('fr')) return 'fr';
  return 'desktop';
}

const LABELS = { desktop: 'Desktop', mobile: 'Mobile', fr: 'Francais' } as const;

/** The fake users belonging to this project. Seeded by the local-dev realm import. */
export function usersFor(projectName: string): ProjectUsers {
  const slug = slugFor(projectName);
  const label = LABELS[slug];

  return {
    employee: { email: `employee-${slug}@smg-demo.test`, name: `Employee ${label}` },
    payroll: {
      email: `payroll-${slug}@smg-demo.test`,
      name: `Payroll ${label}`,
      // The realm seeds this secret, so a test can produce a valid code.
      otpSecret: `cpeople-test-payroll-${slug}`,
    },
    wrongPassword: { email: `wrongpass-${slug}@smg-demo.test` },
    lockout: { email: `lockout-${slug}@smg-demo.test` },
  };
}

/** Users that belong to no project in particular. */
export const USERS = {
  /** A second tenant, for anything that needs to prove the two stay apart. */
  otherTenant: { email: 'employee@atlas-demo.test', name: 'Anas Atlas' },
  /** Used by hand when poking at the stack; no test signs in as these. */
  manager: { email: 'manager@smg-demo.test', name: 'Mounir Manager' },
} as const;

/**
 * A six-digit code for `secret`, the way an authenticator app would produce it.
 *
 * Keycloak stores the shared secret as a plain string and derives the Base32 shown
 * in the QR code from it, so the raw string is what is hashed here.
 */
export function authenticatorCode(secret: string, at: number = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const digest = createHmac('sha1', Buffer.from(secret, 'utf8')).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return (binary % 1_000_000).toString().padStart(6, '0');
}

// Keycloak's field ids are the same in every language; its labels are not, and
// these pages deliberately switch to the user's own language mid-flow.
const SUBMIT = '#kc-login, button[type="submit"], input[type="submit"]';

/**
 * Submits the step and waits for the answer.
 *
 * Without the wait the next step can start before Keycloak has recorded this one,
 * which quietly loses failed attempts and makes the lockout test meaningless.
 */
async function submitStep(page: Page): Promise<void> {
  // Tied to Keycloak's own response rather than to the network going quiet: the
  // Next dev server keeps a hot-reload connection open, so it never does.
  await Promise.all([
    page
      .waitForResponse(
        (response) =>
          response.request().method() === 'POST' && response.url().includes('/login-actions/'),
        { timeout: 20_000 },
      )
      .catch(() => null),
    page.locator(SUBMIT).first().click(),
  ]);
  await page.waitForLoadState('domcontentloaded');
  await pageIsDrawn(page);
}

/**
 * Waits until there is something on the page to look at.
 *
 * The sign-in pages are a React theme, so between the document arriving and the
 * script running there is a moment when the page is empty. A test that asks what is
 * on screen during that moment gets a truthful "nothing" and fails for no reason,
 * which is what happened under load. Every page this suite lands on — ours and the
 * app's — leads with a heading.
 */
async function pageIsDrawn(page: Page): Promise<void> {
  await page.locator('h1').first().waitFor({ state: 'visible', timeout: 20_000 });
}

/**
 * The email step, which belongs to the page and not to Keycloak: it reveals the
 * password field and sends nothing, so there is no response to wait for — only the
 * field that was asked for.
 */
export async function submitEmail(page: Page, email: string): Promise<void> {
  await page.locator('#username').fill(email);
  await page.locator(SUBMIT).first().click();
  await page.locator('#password').waitFor({ state: 'visible' });
}

/** The password step. */
export async function submitPassword(page: Page, password: string): Promise<void> {
  await page.locator('#password').fill(password);
  await submitStep(page);
}

/** The authenticator-code step. */
export async function submitCode(page: Page, secret: string): Promise<void> {
  await page.locator('#otp').fill(authenticatorCode(secret));
  await submitStep(page);
}

/** Any message Keycloak shows when a step fails, in whichever language it used. */
export function errorMessage(page: Page) {
  return page
    .locator('#input-error, #input-error-otp-code, [class*="alert"], .kc-feedback-text')
    .first();
}

/** Starts sign-in from the CPeople landing page and waits for the email step. */
export async function startSignIn(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /sign in|se connecter/i }).click();
  await page.locator('#username').waitFor({ state: 'visible' });
}

/** Switches the app to a language before signing in, which is what sets ui_locales. */
export async function chooseLanguage(page: Page, label: 'English' | 'Français'): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.waitForLoadState('domcontentloaded');
}

/** Admin access to the local realm, for test set-up only. */
async function adminToken(): Promise<string> {
  const response = await fetch(`${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'admin-cli',
      username: 'admin',
      password: 'admin_dev',
      grant_type: 'password',
    }),
  });
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new Error('Could not get a Keycloak admin token. Is the stack up?');
  return body.access_token;
}

/**
 * Clears a user's failed-login count.
 *
 * The lockout test deliberately locks an account; without this the next run would
 * meet a still-locked user and fail for the wrong reason.
 */
export async function clearLockout(email: string): Promise<void> {
  const token = await adminToken();
  const headers = { Authorization: `Bearer ${token}` };
  const found = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${REALM}/users?username=${encodeURIComponent(email)}&exact=true`,
    { headers },
  );
  const [user] = (await found.json()) as { id: string }[];
  if (!user) return;
  await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/attack-detection/brute-force/users/${user.id}`, {
    method: 'DELETE',
    headers,
  });
}

interface MailpitMessage {
  ID: string;
  Subject: string;
  Created: string;
  To: { Address: string }[];
}

/** Waits for a message to `address` and returns it with its body. */
export async function waitForEmail(
  address: string,
  /**
   * Only count mail that arrived after this moment, so a message left by an earlier
   * run cannot answer for one this test is waiting for. Take it before the action
   * that sends the mail.
   */
  sentAfter = 0,
  timeoutMs = 15_000,
): Promise<{ subject: string; body: string }> {
  const deadline = Date.now() + timeoutMs;
  // Mailpit timestamps to the second, and the clocks here are not the same clock.
  const floor = sentAfter === 0 ? 0 : sentAfter - 2_000;

  while (Date.now() < deadline) {
    const response = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=50`);
    const { messages } = (await response.json()) as { messages: MailpitMessage[] };
    const match = messages.find(
      (message) =>
        message.To.some((to) => to.Address.toLowerCase() === address.toLowerCase()) &&
        new Date(message.Created).getTime() >= floor,
    );

    if (match) {
      const full = await fetch(`${MAILPIT_URL}/api/v1/message/${match.ID}`);
      const detail = (await full.json()) as { Subject: string; Text?: string; HTML?: string };
      return { subject: detail.Subject, body: detail.Text ?? detail.HTML ?? '' };
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`No e-mail arrived for ${address} within ${timeoutMs}ms`);
}
