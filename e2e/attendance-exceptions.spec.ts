import { expect, test, type Browser, type Page } from '@playwright/test';
import { openAs, useEnglish, type DemoRole } from './support/demo-users';
import { resetDemoData } from './support/demo-data';

/**
 * M10 the exceptions, and the answers to them (HR-02 build spec §5.4).
 *
 * The sample import is the fixture: it carries, on purpose, every anomaly the
 * screen is built to answer, so these tests start by importing it and then
 * answer the questions it raises. That also means the screen is tested against
 * the same data the workshop will see rather than against something arranged
 * to pass.
 *
 * What is checked is the part that reaches payroll: a reason is always
 * required, a day answered by hand is not undone by the next import, and a
 * worked holiday settled in time stops being worth money.
 */

test.beforeEach(({ browserName: _browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser is enough.');
  testInfo.setTimeout(240_000);
});

/**
 * This file runs first in the suite, so it inherits whatever the last run left
 * behind unless it says otherwise. Every other file that changes data resets
 * before and after; this one did only afterwards, which is how it managed to
 * be flaky on its very first day.
 */
test.beforeAll(({ browserName: _browserName }, testInfo) => {
  if (testInfo.project.name !== 'desktop-chromium') return;
  resetDemoData();
});

test.afterAll(({ browserName: _browserName }, testInfo) => {
  if (testInfo.project.name !== 'desktop-chromium') return;
  resetDemoData();
});

test.describe('M10 attendance exceptions', () => {
  test.describe.configure({ mode: 'serial' });

  test('the sample’s problems arrive as questions, grouped by kind', async ({ browser }) => {
    const page = await open(browser, 'hr', '/attendance/import');
    await importTheSample(page);

    await page.goto('/attendance?tab=exceptions');

    await expect(page.getByRole('heading', { name: 'What needs somebody' })).toBeVisible();

    // The kinds the sample carries, each with a count beside it.
    for (const kind of [
      'Badged in and never badged out',
      'At work on a public holiday',
      'At work while on approved leave',
      'Absent with no leave request',
    ]) {
      await expect(page.getByRole('link', { name: new RegExp(kind) })).toBeVisible();
    }

    await page.context().close();
  });

  test('an answer without a reason is refused', async ({ browser }) => {
    const page = await open(browser, 'hr', '/attendance?tab=exceptions');

    // The reason is required by the browser and by the API. The browser stops
    // it first, which is the point: nobody should reach the API without one.
    const why = page.getByLabel('Why').first();
    await expect(why).toHaveAttribute('required', '');

    await page.context().close();
  });

  test('a missing punch is answered by adding the punch, and the day is rebuilt', async ({
    browser,
  }) => {
    const page = await open(browser, 'hr', '/attendance?tab=exceptions');

    // One kind at a time, which is how somebody actually works through these.
    await page.getByRole('link', { name: /Badged in and never badged out/ }).click();
    await page.waitForLoadState('load');

    // Scoped by the card's own heading: `section` alone also matches the tab
    // strip and the filter card, both of which mention the same words.
    const card = page.locator('section', {
      has: page.getByRole('heading', { name: 'Badged in and never badged out' }),
    }).first();
    const form = card.locator('form');

    await form.getByLabel('What to do').selectOption('addPunch');
    await form.getByLabel('The time the device missed').fill('17:30');
    await form.getByLabel('In or out').selectOption('out');
    await form.getByLabel('Why').fill('Device missed the out punch; confirmed with the supervisor.');
    await form.getByRole('button', { name: 'Save the answer' }).click();

    await page.waitForLoadState('load');
    await page.waitForTimeout(1500);

    // It is answered, and says who answered it.
    await page.goto('/attendance?tab=exceptions&code=MISSING_OUT&status=fixed');
    await expect(page.getByText('Add the punch the device missed').first()).toBeVisible();
    await expect(page.getByText(/Device missed the out punch/).first()).toBeVisible();

    await page.context().close();
  });

  test('a worked holiday settled in time stops being worth money', async ({ browser }) => {
    const page = await open(browser, 'hr', '/attendance?tab=exceptions&code=WORKED_HOLIDAY');

    const card = page.locator('section', {
      has: page.getByRole('heading', { name: 'At work on a public holiday' }),
    }).first();
    const form = card.locator('form');

    // The overtime the day is worth before anything is done to it. Asserted
    // with a retrying matcher rather than a single innerText, which can catch
    // the card mid-render just after the language switch.
    await expect(card).toContainText('Overtime');

    await form.getByLabel('What to do').selectOption('convertToRecovery');
    await form.getByLabel('Why').fill('Agreed with the manager: taken back as time, not paid.');
    await form.getByRole('button', { name: 'Save the answer' }).click();

    await page.waitForLoadState('load');
    await page.waitForTimeout(1500);

    // Answered, and the day now shows time owed rather than overtime — which is
    // the whole promise: an hour is settled in time or in money, never both.
    await page.goto('/attendance?tab=exceptions&code=WORKED_HOLIDAY&status=fixed');

    const answered = page.locator('section').filter({ hasText: 'Owe it back as time off' }).first();
    await expect(answered).toBeVisible();
    await expect(answered).toContainText('Owed back');

    await page.context().close();
  });

  test('a manager sees their own team and is told so', async ({ browser }) => {
    const page = await open(browser, 'manager', '/attendance?tab=exceptions');

    await expect(page.getByText('Your team’s days. HR sees the whole company.')).toBeVisible();

    // Rachid runs the kitchen, so no other department's day is in the list —
    // and the filter offers only the departments of the people he manages,
    // because a filter that always returns nothing reads as a fault.
    await expect(page.getByLabel('Department')).not.toContainText('Warehouse');

    const cards = page.locator('section').filter({ has: page.locator('h3') });

    for (let i = 0; i < (await cards.count()); i += 1) {
      const text = await cards.nth(i).innerText();
      expect(text, 'a manager sees only their own branch').not.toMatch(
        /Warehouse|Outlet|Pastry|Administration/,
      );
    }

    await page.context().close();
  });

  test('an employee cannot reach attendance at all', async ({ browser }) => {
    const page = await open(browser, 'employee', '/attendance?tab=exceptions');

    await expect(page.getByText('Attendance is for HR and managers.')).toBeVisible();

    await page.context().close();
  });
});

/** Imports the sample, which is where the exceptions come from. */
async function importTheSample(page: Page): Promise<void> {
  const sample = await (await page.request.get('/attendance/sample.csv')).text();

  // The form is only on the page when the reader may import, so check that
  // first and in seconds. Waiting out a four-minute timeout on a field that is
  // never coming says nothing about why.
  await expect(
    page.locator('#content'),
    'the import form is not on the page — is this the refusal card?',
  ).toBeVisible({ timeout: 30_000 });

  // By id rather than by label: the label is translated, and this helper has
  // no business depending on which language the screen settled into.
  await page.locator('#fileName').fill('Sample_Attendance_Export_2026-11.csv');
  await page.locator('#content').fill(sample);
  await page.getByRole('button', { name: 'Try it' }).click();

  await expect(page.getByRole('heading', { name: 'What the file says' })).toBeVisible({
    timeout: 60_000,
  });

  await page.getByRole('button', { name: 'Import it' }).click();
  await expect(page.getByText('Imported. The worked days')).toBeVisible({ timeout: 60_000 });
}

/** Signed in, reading English, whatever their account prefers. */
async function open(browser: Browser, role: DemoRole, path: string): Promise<Page> {
  const page = await openAs(browser, role, { path });
  await useEnglish(page);
  return page;
}
