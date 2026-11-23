import { mkdirSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { resetDemoData } from './support/demo-data';
import { DEMO_USERS, useEnglish, type DemoRole } from './support/demo-users';
import {
  dismissWelcome,
  startSignIn,
  submitEmail,
  submitPassword,
  TEST_PASSWORD,
} from './support/sign-in';

/**
 * The HR-01 workshop, rehearsed (spec section 8).
 *
 * This walks the presenter guide — docs/demo/HR-01-presenter-guide.md — scene by
 * scene, in order, against a freshly reset demo. It is how we know the guide is
 * true on the morning, and it leaves the screenshots the guide prints behind it.
 *
 * It is not part of the ordinary suite: it changes a lot of data on purpose and
 * takes several minutes. Run it the day before and the morning of:
 *
 *   pnpm demo:rehearse
 *
 * Every sign-in here is email and password only. If two-step sign-in has not
 * been switched off for the workshop (`pnpm demo:prepare`), scene 1 fails at the
 * first sign-in, which is exactly the warning a presenter needs.
 */

const SHOTS = 'docs/demo/screenshots';
const STAGE = { width: 1280, height: 800 };

test.beforeEach(({ browserName: _browserName }, testInfo) => {
  test.skip(
    process.env.CPEOPLE_REHEARSAL !== '1',
    'The rehearsal runs on request: pnpm demo:rehearse',
  );
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The workshop is given in one browser.');
  testInfo.setTimeout(300_000);
});

test.beforeAll(({ browserName: _browserName }, testInfo) => {
  if (process.env.CPEOPLE_REHEARSAL !== '1') return;
  if (testInfo.project.name !== 'desktop-chromium') return;

  mkdirSync(SHOTS, { recursive: true });
  resetDemoData();
});

test.describe('HR-01 workshop rehearsal', () => {
  test.describe.configure({ mode: 'serial' });

  test('Scene 1 · roles: three people, three different companies', async ({ browser }) => {
    // Signed in the way the presenter will: by hand, with a password, no code.
    const context = await browser.newContext({ viewport: STAGE, timezoneId: 'Africa/Casablanca' });
    const page = await context.newPage();

    await startSignIn(page);
    await shot(page, 'scene1-01-sign-in-email');

    await submitEmail(page, DEMO_USERS.hr.email);
    await shot(page, 'scene1-02-sign-in-password');

    await submitPassword(page, TEST_PASSWORD);
    // No authenticator step: demo mode is on, or this fails here.
    await expect(page).toHaveURL(/\/home$/, { timeout: 30_000 });

    // Caught a second and a bit in, where the C has drawn itself and the three
    // people have arrived. At the first frame there is nothing on screen yet.
    await page.waitForTimeout(1_300);
    await shot(page, 'scene1-03-welcome-animation');

    await dismissWelcome(page);
    await useEnglish(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Salma');
    await expect(
      page.getByRole('region', { name: 'Today at a glance' }).getByRole('link').first(),
    ).toContainText('148');
    await shot(page, 'scene1-04-hr-home');

    // The same company, seen by the kitchen's head: his own branch of it.
    const manager = await signIn(browser, 'manager');
    await expect(
      manager.getByRole('region', { name: 'Today at a glance' }).getByRole('link').first(),
    ).toContainText('46');
    await shot(manager, 'scene1-05-manager-home');

    await manager.goto('/employees');
    await expect(manager.getByText('46 employees')).toBeVisible();
    await shot(manager, 'scene1-06-manager-list');

    // And a file of his team's, with the private parts withheld.
    await manager.getByRole('link', { name: /^Open / }).first().click();
    await manager.goto(`${manager.url().split('?')[0]}?tab=pay`);
    await expect(manager.getByText('••••').first()).toBeVisible();
    await shot(manager, 'scene1-07-manager-masked');

    // An employee: one file, their own.
    const employee = await signIn(browser, 'employee');
    await employee.goto('/employees');
    await expect(employee.getByText('1 employees')).toBeVisible();
    await shot(employee, 'scene1-08-employee-own-file');

    // Back to HR for the two settings screens.
    await page.goto('/settings/roles');
    await expect(page.getByText('Proposed — to confirm with SMG')).toBeVisible();
    await shot(page, 'scene1-09-roles-matrix');

    await page.goto('/settings/audit');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Audit log');
    await shot(page, 'scene1-10-audit-log');

    await manager.context().close();
    await employee.context().close();
    await context.close();
  });

  test('Scene 2 · the employee file, changed and recorded', async ({ browser }) => {
    const page = await signIn(browser, 'hr');

    await page.goto('/employees?q=karim');
    await expect(page.getByRole('link', { name: 'Open Karim Alaoui' })).toBeVisible();
    await shot(page, 'scene2-01-search-karim');

    await page.getByRole('link', { name: 'Open Karim Alaoui' }).click();
    const file = page.url().split('?')[0]!;
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Karim Alaoui');
    await shot(page, 'scene2-02-file-overview');

    await page.goto(`${file}?tab=pay`);
    await expect(page.getByText('Used by payroll — workshop HR-03.')).toBeVisible();
    await shot(page, 'scene2-03-file-pay');

    // The edit the workshop watches: a phone number, and what it leaves behind.
    await page.goto(`${file}?edit=1`);
    await page.getByLabel('Phone').fill('+212 661 45 78 90');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved. The change is in the history.')).toBeVisible();
    await shot(page, 'scene2-04-saved');

    await page.goto(`${file}?tab=history`);
    await expect(page.getByRole('listitem').first()).toContainText('+212 661 45 78 90');
    await expect(page.getByRole('listitem').first()).toContainText('Salma Benali');
    await shot(page, 'scene2-05-history-diff');

    // A certificate that runs out in ten days, and the figure that follows it.
    await page.goto(`${file}?tab=documents&edit=1`);
    await page.getByLabel('Kind of document').selectOption({ label: 'Medical aptitude certificate' });
    await page.getByLabel('File', { exact: true }).setInputFiles({
      name: 'certificat-medical.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n%%EOF\n', 'utf8'),
    });
    await page.getByLabel('Expires on').fill('2026-12-03');
    await page.getByRole('button', { name: 'Add it to the file' }).click();
    await expect(page.getByText('Added to the file.', { exact: false })).toBeVisible();
    await shot(page, 'scene2-06-document-expiring');

    await page.goto('/home');
    await expect(
      page.getByRole('region', { name: 'Today at a glance' }).getByRole('link').nth(3),
    ).toContainText('6');
    await shot(page, 'scene2-07-home-kpi-changed');

    await page.context().close();
  });

  test('Scene 3 · the organisation, and what payroll posts against', async ({ browser }) => {
    const page = await signIn(browser, 'hr');

    await page.goto('/settings/organisation');
    await expect(page.getByRole('row').filter({ hasText: 'Kitchen' }).first()).toContainText(
      'CC-KIT',
    );
    await shot(page, 'scene3-01-departments');

    await page.goto('/settings/organisation?tab=costCentres');
    await expect(page.getByText('To map with Finance').first()).toBeVisible();
    await shot(page, 'scene3-02-cost-centres');

    await page.goto('/settings/organisation?tab=mapping');
    await expect(page.getByText('In order').first()).toBeVisible();
    await shot(page, 'scene3-03-mapping');

    await page.goto('/org?department=KIT');
    await expect(page.getByRole('link', { name: 'Open Rachid Kettani' })).toBeVisible();
    await shot(page, 'scene3-04-org-chart-kitchen');

    await page.context().close();
  });

  test('Scene 4 · hiring a commis on a fixed term', async ({ browser }) => {
    const page = await signIn(browser, 'hr');

    await page.goto('/employees/new');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('New employee');
    await shot(page, 'scene4-01-wizard-identity');

    await step(page, async () => {
      await page.getByLabel('First name').first().fill('Yasmine');
      await page.getByLabel('Last name').first().fill('Haddad');
      await page.getByLabel('Date of birth').first().fill('2001-04-12');
      await page.getByLabel('CIN').fill(`DEMO${Date.now().toString().slice(-6)}`);
    });

    await step(page, async () => {
      await page.getByLabel('Position').selectOption('POS-KIT-STAFF');
      await page.getByLabel('Start date').fill('2026-12-01');
    });
    await step(page, async () => {
      await page.getByLabel(/Base salary, monthly/).fill('4200');
    });
    await step(page, async () => undefined);
    await step(page, async () => {
      await page.getByLabel('Kind of contract').selectOption('CDD');
      await page.getByLabel('Ends on').fill('2027-05-31');
    });

    await expect(page.getByText('Yasmine Haddad')).toBeVisible();
    await shot(page, 'scene4-02-wizard-review');

    await page.getByRole('button', { name: 'Create the employee' }).click();
    await expect(page).toHaveURL(/\/employees\/[0-9a-f-]{36}\?created=1$/);
    const file = page.url().split('?')[0]!;
    await shot(page, 'scene4-03-created');

    // The contract that was created with her, generated as a PDF.
    await page.goto(`${file}?tab=contracts`);
    await page.getByRole('link', { name: /Contrat/ }).first().click();
    await shot(page, 'scene4-04-contract-preview');

    await page.getByRole('button', { name: /^Generate/ }).click();
    await expect(page.getByText('Generated.', { exact: false })).toBeVisible({ timeout: 90_000 });
    await shot(page, 'scene4-05-contract-generated');

    await page.getByLabel('The signed scan').setInputFiles({
      name: 'contrat-signe.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n%%EOF\n', 'utf8'),
    });
    await page.getByRole('button', { name: 'Mark it signed' }).click();
    await expect(page.getByText('Signed.', { exact: false })).toBeVisible({ timeout: 90_000 });
    await shot(page, 'scene4-06-contract-signed');

    // Her checklist, with the contract item already ticked by the signing.
    await page.goto(`${file}?tab=onboarding`);
    await expect(page.getByText('Generate and sign the contract')).toBeVisible();
    await shot(page, 'scene4-07-onboarding-list');

    const tick = page.getByRole('button', { name: 'Mark done' });
    let left = await tick.count();

    while (left > 0) {
      await tick.first().click();
      await expect(tick).toHaveCount(left - 1, { timeout: 30_000 });
      left -= 1;
    }

    await page.getByRole('button', { name: 'Make this file active' }).click();
    await expect(page.getByText('Everything required has been done.')).toBeVisible();
    await page.goto(file);
    await expect(page.getByText('Active', { exact: true }).first()).toBeVisible();
    await shot(page, 'scene4-08-active');

    await page.context().close();
  });

  test('Scene 5 · the fixed term that ends this month', async ({ browser }) => {
    const page = await signIn(browser, 'hr');

    await expect(
      page.getByRole('region', { name: 'Waiting for you' }).getByText('Omar Chraibi', {
        exact: false,
      }),
    ).toBeVisible();
    await shot(page, 'scene5-01-home-waiting');

    await page.goto('/contracts?view=ending');
    await page.getByRole('row').filter({ hasText: 'Omar Chraibi' }).getByRole('link').first().click();
    await expect(page.getByText('Check renewal limits', { exact: false })).toBeVisible();
    await shot(page, 'scene5-02-omar-contract');

    await page.getByLabel('The new term ends on').fill('2027-05-31');
    await page.getByRole('button', { name: 'Renew', exact: true }).click();
    await expect(page.getByText('Renewed.', { exact: false })).toBeVisible();
    await shot(page, 'scene5-03-renewed');

    await page.goto('/home');
    await expect(
      page.getByRole('region', { name: 'Waiting for you' }).getByText('fixed-term contract ends', {
        exact: false,
      }),
    ).toHaveCount(0);
    await shot(page, 'scene5-04-home-cleared');

    await page.context().close();
  });

  test('Scene 6 · the employee data template', async () => {
    // Step 12 of the build order. Not built, so the workshop talks it through
    // from the agreement rather than showing it; the guide says so too.
    test.skip(true, 'Not built: the data template download and import are step 12.');
  });
});

/** One step of the wizard: fill it, wait for it to be accepted, move on. */
async function step(page: Page, fill: () => Promise<void>): Promise<void> {
  const next = page.getByRole('button', { name: 'Next' });

  await expect(async () => {
    await fill();
    await expect(next).toBeEnabled({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });

  await next.click();
}

/** Signed in as one of the demo's people, by password, reading English. */
async function signIn(browser: Browser, role: DemoRole): Promise<Page> {
  const context = await browser.newContext({ viewport: STAGE, timezoneId: 'Africa/Casablanca' });
  const page = await context.newPage();

  await startSignIn(page);
  await submitEmail(page, DEMO_USERS[role].email);
  await submitPassword(page, TEST_PASSWORD);
  await expect(page).toHaveURL(/\/home$/, { timeout: 30_000 });

  await dismissWelcome(page);
  await useEnglish(page);

  return page;
}

/** A screenshot for the guide, named for the moment it shows. */
async function shot(page: Page, name: string): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}
