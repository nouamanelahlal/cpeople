import { createHmac } from 'node:crypto';
import type { Page } from '@playwright/test';

/** The local realm, started by infra/docker/docker-compose.yml. */
export const KEYCLOAK_URL = process.env.E2E_KEYCLOAK_URL ?? 'http://localhost:8080';
export const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025';
export const REALM = 'cpeople';

/** Fake demo users, seeded by the realm import. Fake data only (CLAUDE.md rule 6). */
export const TEST_PASSWORD = 'CPeople-Test-2027!';

export const USERS = {
  /** Needs an authenticator code: payroll-manager is composed of mfa-required. */
  payroll: {
    email: 'payroll@smg-demo.test',
    name: 'Pierre Paie',
    /** The secret the realm seeds, so a test can produce a valid code. */
    otpSecret: 'cpeople-test-payroll-secret',
  },
  /** No code step: employee is not an mfa-required role. */
  employee: { email: 'employee@smg-demo.test', name: 'Salma Salarie' },
  manager: { email: 'manager@smg-demo.test', name: 'Mounir Manager' },
  /** A second tenant, for anything that needs to prove the two stay apart. */
  otherTenant: { email: 'employee@atlas-demo.test', name: 'Anas Atlas' },
  /**
   * These two exist only so a test can fail a password on purpose. Failed-attempt
   * counts are server-side and shared, so a user whose password gets deliberately
   * mistyped must not be one another test needs to sign in with.
   */
  wrongPassword: { email: 'wrong-password-test@smg-demo.test', name: 'Wrong Password' },
  lockout: { email: 'lockout-test@smg-demo.test', name: 'Locked Out' },
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
}

/** The email step of the sign-in flow. */
export async function submitEmail(page: Page, email: string): Promise<void> {
  await page.locator('#username').fill(email);
  await submitStep(page);
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
  To: { Address: string }[];
}

/** Deletes every message, so a test only ever sees the one it caused. */
export async function clearMailbox(): Promise<void> {
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE' });
}

/** Waits for a message to `address` and returns it with its body. */
export async function waitForEmail(
  address: string,
  timeoutMs = 15_000,
): Promise<{ subject: string; body: string }> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const response = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=50`);
    const { messages } = (await response.json()) as { messages: MailpitMessage[] };
    const match = messages.find((message) =>
      message.To.some((to) => to.Address.toLowerCase() === address.toLowerCase()),
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
