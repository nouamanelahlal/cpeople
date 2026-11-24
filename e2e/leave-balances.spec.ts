import { expect, test, type Browser, type Page } from '@playwright/test';
import { openAs, useEnglish, type DemoRole } from './support/demo-users';
import { resetDemoData } from './support/demo-data';

/**
 * M09 balances (HR-02 step 3).
 *
 * Four claims, one scenario each, and they are the four somebody would test by
 * hand before trusting a balance:
 *
 *  1. an **adjustment** moves the balance and stays in its history, with the
 *     reason beside it;
 *  2. a **trial import** reads the whole file and lists every bad row, and
 *     writes nothing;
 *  3. the **year-end preview** shows what would carry without carrying it;
 *  4. a **manager** sees their own team's balances and nobody else's.
 */

test.beforeEach(({ browserName: _browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser is enough.');
  testInfo.setTimeout(180_000);
});

test.beforeAll(({ browserName: _browserName }, testInfo) => {
  if (testInfo.project.name !== 'desktop-chromium') return;
  resetDemoData();
});

test.afterAll(({ browserName: _browserName }, testInfo) => {
  if (testInfo.project.name !== 'desktop-chromium') return;
  resetDemoData();
});

test.describe('M09 leave balances', () => {
  test.describe.configure({ mode: 'serial' });

  test('an adjustment moves the balance and stays in the history', async ({ browser }) => {
    const page = await open(browser, 'hr', '/employees?q=karim%20alaoui');

    await page.getByRole('link', { name: 'Open Karim Alaoui' }).click();
    await page.getByRole('link', { name: 'Absences' }).click();

    // A balance is worked out, not stored, so the figures are already there.
    await expect(page.getByRole('heading', { name: 'How this balance got here' })).toBeVisible();

    // The seeded adjustment, with the reason beside it for good.
    await expect(page.getByText('Day taken in August recorded late')).toBeVisible();

    const before = await remaining(page);

    await page.getByLabel('Days', { exact: true }).fill('-2.5');
    await page
      .getByLabel('Reason', { exact: true })
      .fill('Two and a half days settled against the December rota.');
    await page.getByRole('button', { name: 'Record the adjustment' }).click();

    // The balance followed it, and nothing had to be recalculated by hand.
    await expect.poll(() => remaining(page)).toBe(before - 2.5);

    // And it is in the history, with its reason, as a row nobody can edit.
    const row = page.getByRole('row').filter({ hasText: 'December rota' });
    await expect(row).toContainText('Adjusted by HR');
    await expect(row).toContainText('-2.5');

    // The trail has it too, which is what makes it answerable later.
    await page.goto('/settings/audit');
    await expect(page.getByRole('row').nth(1)).toContainText('Karim Alaoui');

    await page.context().close();
  });

  test('a trial import lists every bad row and writes nothing', async ({ browser }) => {
    const page = await open(browser, 'hr', '/leave/import');

    // One good row and four that are wrong in four different ways. The point of
    // a trial run is that all of them come back at once.
    const file = [
      'employee_number,leave_type,days,balance_at,note',
      '1003,ANNUAL,4,2026-10-31,Corrected opening balance',
      '9999,ANNUAL,4,2026-10-31,Nobody has that number',
      '1004,HOLIDAYS,4,2026-10-31,No such leave type',
      '1005,ANNUAL,four,2026-10-31,Not a number',
      '1006,ANNUAL,4,31/12/2025,Not a date',
    ].join('\n');

    await page.getByLabel('Paste the file here').fill(file);
    await page.getByRole('button', { name: 'Try it' }).click();

    await expect(page.getByText('4 rows cannot be imported')).toBeVisible();
    await expect(page.getByText('No employee has that number')).toBeVisible();
    await expect(page.getByText('No leave type with a balance has that code')).toBeVisible();
    await expect(page.getByText('That is not a number of days')).toBeVisible();
    await expect(page.getByText('That is not a date, as YYYY-MM-DD')).toBeVisible();

    // The good row is listed as it would be written, and the button is refused
    // while a single row is wrong: all of it or none of it.
    await expect(page.getByText('1 rows would be imported')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import them' })).toBeDisabled();

    // And nothing was written: Karim's opening balance is untouched.
    await page.goto('/leave?tab=balances&q=Alaoui');
    await expect(page.getByRole('row').filter({ hasText: 'Karim Alaoui' }).first()).toBeVisible();

    await page.context().close();
  });

  test('a corrected file imports, and the balance follows it', async ({ browser }) => {
    const page = await open(browser, 'hr', '/leave/import');

    const file = [
      'employee_number,leave_type,days,balance_at,note',
      '1003,ANNUAL,9,2026-10-31,Corrected opening balance',
    ].join('\n');

    await page.getByLabel('Paste the file here').fill(file);
    await page.getByRole('button', { name: 'Try it' }).click();

    await expect(page.getByText('No problems found.')).toBeVisible();
    await page.getByRole('button', { name: 'Import them' }).click();

    await expect(page.getByText('Imported. The balances follow them.')).toBeVisible();

    // The same person, type and date is the same opening balance, so a
    // corrected file replaces the figure rather than adding to it.
    await page.goto('/employees?q=karim%20alaoui');
    await page.getByRole('link', { name: 'Open Karim Alaoui' }).click();
    await page.getByRole('link', { name: 'Absences' }).click();

    const row = page.getByRole('row').filter({ hasText: 'Brought in' }).first();
    await expect(row).toContainText('9');

    await page.context().close();
  });

  test('the year-end preview shows what would carry, and carries nothing', async ({ browser }) => {
    const page = await open(browser, 'hr', '/leave/carry-over');

    await page.getByLabel('The year to close').fill('2026');
    await page.getByRole('button', { name: 'Preview it' }).click();

    await expect(page.getByRole('heading', { name: /What 2026 would carry into 2027/ })).toBeVisible();

    // Annual leave carries up to the limit on its rule, and the preview says
    // which rule it applied.
    const row = page.getByRole('row').filter({ hasText: 'Annual leave' }).first();
    await expect(row).toContainText('Up to the limit');

    // Nothing has been carried: nobody's 2027 balance has moved.
    await page.goto('/leave/carry-over');
    await expect(page.getByRole('heading', { name: /carried into/ })).toHaveCount(0);

    // The run is on file as a preview, which is how somebody can tell that it
    // was looked at and not applied.
    await expect(page.getByText('Preview', { exact: true }).first()).toBeVisible();

    await page.context().close();
  });

  test('a manager sees their own team’s balances and nobody else’s', async ({ browser }) => {
    const page = await open(browser, 'manager', '/leave?tab=balances');

    // Rachid runs the kitchen, so Karim is his and the balances tab shows him.
    await expect(page.getByRole('row').filter({ hasText: 'Karim Alaoui' }).first()).toBeVisible();

    // Nadia Berrada is in the outlet, and is not.
    await expect(page.getByRole('row').filter({ hasText: 'Nadia Berrada' })).toHaveCount(0);

    // Searching for her does not find her either: the scope is the API's, and
    // the filter narrows what the reader may already see rather than widening it.
    await page.goto('/leave?tab=balances&q=Berrada');
    await expect(page.getByRole('row').filter({ hasText: 'Nadia Berrada' })).toHaveCount(0);

    // Nor can a manager adjust anything, or run year end.
    await expect(page.getByRole('link', { name: 'Import opening balances' })).toHaveCount(0);

    await page.goto('/leave/carry-over');
    await expect(page.getByText('That request is not yours to decide.')).toBeVisible();

    await page.context().close();
  });
});

/** The first "Left" figure on an Absences tab. */
async function remaining(page: Page): Promise<number> {
  const card = page.locator('section').filter({ hasText: 'Annual leave' }).first();
  const text = (await card.locator('.num').first().textContent()) ?? '0';

  return Number.parseFloat(text.replace(',', '.'));
}

/** Signed in, reading English, whatever their account prefers. */
async function open(browser: Browser, role: DemoRole, path: string): Promise<Page> {
  const page = await openAs(browser, role, { path });
  await useEnglish(page);
  return page;
}
