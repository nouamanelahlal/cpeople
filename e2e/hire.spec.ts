import { expect, test, type Browser, type Page } from '@playwright/test';
import { openAs, useEnglish, type DemoRole } from './support/demo-users';

/**
 * Hiring somebody, and the list that follows them in (HR-01 spec 6.4 and 6.8).
 *
 * The demo's 14:15 slot: a kitchen commis on a fixed term, created from nothing,
 * with a draft contract and a checklist waiting. The acceptance criterion the
 * spec sets is the duplicate CIN, so that is checked first.
 */

test.beforeEach(({ browserName: _browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser is enough.');
  testInfo.setTimeout(180_000);
});

/** Invented, and unique to this test, so a re-run does not meet its own leftovers. */
const CIN = `TEST${Date.now().toString().slice(-6)}`;

test.describe('HR-01 hiring', () => {
  test.describe.configure({ mode: 'serial' });

  test('refuses a CIN that belongs to somebody else, and names them', async ({ browser }) => {
    // Karim Alaoui's own identifier, read from his file.
    const page = await open(browser, 'hr', '/employees?q=karim%20alaoui');
    await page.getByRole('link', { name: 'Open Karim Alaoui' }).click();

    const cin = await page
      .locator('dt', { hasText: /^CIN$/ })
      .locator('xpath=following-sibling::dd[1]')
      .first()
      .textContent();

    await page.goto('/employees/new');
    await fillIdentity(page, { nationalId: (cin ?? '').trim() });
    await fillJob(page);
    await fillPay(page);
    await fillFamily(page);
    await fillContract(page);
    await page.getByRole('button', { name: 'Create the employee' }).click();

    await expect(page.getByText('Another employee already has that CIN.')).toBeVisible();
    await expect(page.getByRole('link', { name: /Open Karim Alaoui/ })).toBeVisible();

    await page.context().close();
  });

  test('hires a commis on a fixed term, with a contract and a checklist', async ({ browser }) => {
    const page = await open(browser, 'hr', '/employees');

    await page.getByRole('link', { name: 'New employee' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('New employee');

    await fillIdentity(page, { nationalId: CIN });
    await fillJob(page);
    await fillPay(page);
    await fillFamily(page);
    await fillContract(page);

    // The review step repeats what is about to happen. The kinds of contract are
    // reference data, seeded in French as SMG would hold them, and shown as they
    // are stored rather than translated.
    await expect(page.getByText('Nadia Testeur')).toBeVisible();
    await expect(page.getByText('Contrat à durée déterminée')).toBeVisible();

    await page.getByRole('button', { name: 'Create the employee' }).click();

    // It lands on the new file, which starts as onboarding.
    await expect(page).toHaveURL(/\/employees\/[0-9a-f-]{36}\?created=1$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nadia Testeur');
    await expect(page.getByText('Onboarding', { exact: true }).first()).toBeVisible();

    // A draft contract is waiting.
    await page.goto(`${page.url().split('?')[0]}?tab=contracts`);
    await expect(page.getByText('Draft')).toBeVisible();

    // And the checklist for the kitchen, which has two items the other
    // departments do not.
    await page.goto(`${page.url().split('?')[0]}?tab=onboarding`);
    await expect(page.getByText('Collect the identity document')).toBeVisible();
    await expect(page.getByText('Medical aptitude certificate')).toBeVisible();
    await expect(page.getByText('Hygiene and safety induction')).toBeVisible();
    await expect(page.getByText('0 of 8 done')).toBeVisible();

    await page.context().close();
  });

  test('ticks the list off and makes the file active', async ({ browser }) => {
    const page = await open(browser, 'hr', `/employees?q=${encodeURIComponent('Nadia Testeur')}`);
    await page.getByRole('link', { name: 'Open Nadia Testeur' }).click();
    await page.goto(`${page.url().split('?')[0]}?tab=onboarding`);

    // Not until everything that must happen has.
    await expect(page.getByRole('button', { name: 'Make this file active' })).toHaveCount(0);

    // Ticked one at a time, waiting for each to be gone before the next: every
    // tick is a round trip that records who did it.
    const tick = page.getByRole('button', { name: 'Mark done' });
    let left = await tick.count();
    expect(left).toBeGreaterThan(0);

    while (left > 0) {
      await tick.first().click();
      await expect(tick).toHaveCount(left - 1, { timeout: 30_000 });
      left -= 1;
    }

    await page.getByRole('button', { name: 'Make this file active' }).click();
    await expect(page.getByText('Everything required has been done.')).toBeVisible();

    // The file is now a working employee's.
    await page.goto(page.url().split('?')[0]!);
    await expect(page.getByText('Active', { exact: true }).first()).toBeVisible();

    await page.context().close();
  });
});

async function fillIdentity(page: Page, options: { nationalId: string }): Promise<void> {
  // Filled until the wizard agrees the step is complete. A field typed into
  // before the page has hydrated is a field React has not seen, and the Next
  // button is the wizard's own answer to "have you given me enough?".
  await untilReady(page, async () => {
    await page.getByLabel('First name').first().fill('Nadia');
    await page.getByLabel('Last name').first().fill('Testeur');
    await page.getByLabel('Date of birth').first().fill('1998-03-14');
    await page.getByLabel('CIN').fill(options.nationalId);
  });
}

async function fillJob(page: Page): Promise<void> {
  await untilReady(page, async () => {
    await page.getByLabel('Position').selectOption('POS-KIT-STAFF');
    await page.getByLabel('Start date').fill('2026-12-01');
  });
}

async function fillPay(page: Page): Promise<void> {
  await untilReady(page, async () => {
    await page.getByLabel(/Base salary, monthly/).fill('6500');
  });
}

async function fillFamily(page: Page): Promise<void> {
  await untilReady(page, async () => undefined);
}

async function fillContract(page: Page): Promise<void> {
  await untilReady(page, async () => {
    await page.getByLabel('Kind of contract').selectOption('CDD');
    await page.getByLabel('Ends on').fill('2027-05-31');
  });
}

/**
 * Fills a step, waits for the wizard to accept it, and moves on.
 *
 * `Next` is disabled while a step is missing something, so it doubles as the
 * signal that the browser has caught up with what was typed.
 */
async function untilReady(page: Page, fill: () => Promise<void>): Promise<void> {
  const next = page.getByRole('button', { name: 'Next' });

  await expect(async () => {
    await fill();
    await expect(next).toBeEnabled({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });

  await next.click();
}

/** Signed in, reading English, whatever their account prefers. */
async function open(browser: Browser, role: DemoRole, path: string): Promise<Page> {
  const page = await openAs(browser, role, { path });
  await useEnglish(page);
  return page;
}
