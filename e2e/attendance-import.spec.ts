import { expect, test, type Browser, type Page } from '@playwright/test';
import { openAs, useEnglish, type DemoRole } from './support/demo-users';
import { resetDemoData } from './support/demo-data';

/**
 * M10 the attendance import (HR-02 build spec §5.3, acceptance for §9.5).
 *
 * The acceptance the spec sets is exact: **importing the sample shows exactly
 * the anomalies of §5.2.** So this file imports the sample the screen itself
 * offers and reads the anomalies off the screen — not out of the API. A count
 * that is right in a JSON body and absent from the page would pass a weaker
 * test and fail the workshop.
 *
 * It also checks the two promises the wizard makes: a trial writes nothing, and
 * the numbers nobody has are named rather than quietly matched.
 */

test.beforeEach(({ browserName: _browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser is enough.');
  testInfo.setTimeout(240_000);
});

test.afterAll(({ browserName: _browserName }, testInfo) => {
  if (testInfo.project.name !== 'desktop-chromium') return;
  // The commit writes punches and days, so the next suite starts clean.
  resetDemoData();
});

test.describe('M10 attendance import', () => {
  test.describe.configure({ mode: 'serial' });

  test('a trial run finds exactly the sample’s problems, and writes nothing', async ({
    browser,
  }) => {
    const page = await open(browser, 'hr', '/attendance/import');

    await tryTheSample(page);

    // What the file says, read off the screen.
    await expect(page.getByRole('heading', { name: 'What the file says' })).toBeVisible();
    expect(await figure(page, 'Punches')).toBeGreaterThan(100);
    expect(await figure(page, 'Days built')).toBeGreaterThan(100);

    // §5.2, anomaly 1: three numbers that match nobody. Two belong to nobody
    // at all; the third is a real number sent with a leading zero, which is the
    // employee-number format question SMG still owes us an answer to.
    await expect(page.getByRole('heading', { name: /3 numbers nobody has/ })).toBeVisible();
    expect(await figure(page, 'Unmatched')).toBeGreaterThan(0);

    const unknowns = page.getByRole('row').filter({ hasText: /^(9001|9002|0\d+)/ });
    await expect(unknowns).toHaveCount(3);

    await expect(page.getByRole('row').filter({ hasText: '9001' })).toHaveCount(1);
    await expect(page.getByRole('row').filter({ hasText: '9002' })).toHaveCount(1);

    // The padded one is *named*, not matched: the person it looks like is
    // shown beside it, and nothing is joined up on anybody's behalf.
    const padded = page.getByRole('row').filter({ hasText: /^0\d+/ });
    await expect(padded).toHaveCount(1);

    const asSent = (await padded.getByRole('rowheader').innerText()).trim();
    const asHeld = asSent.replace(/^0+/, '');

    expect(asHeld, 'the padded number is a real one with a zero in front').not.toBe(asSent);
    await expect(
      padded.getByRole('cell').last(),
      'the row names the employee the number looks like',
    ).toContainText(asHeld);

    // §5.2, anomaly 2: two double badges inside the minute, taken out of the
    // count of worked time. They are kept as punches, marked rather than
    // deleted, so "why is this one not counted" has an answer.
    expect(await figure(page, 'Double badges')).toBe(2);
    expect(await figure(page, 'Punches')).toBe(
      (await figure(page, 'Matched')) + (await figure(page, 'Unmatched')),
    );

    // §5.2, anomalies 3 to 7, in the number the sample says it put there.
    // "Exactly the anomalies of §5.2" is the acceptance, so the counts are
    // asserted and not merely their presence: a sample that promises thirty
    // holiday workers and an import that finds sixty-eight disagree in public.
    //
    // The early starts on the pastry shift are the one §5.2 item with no
    // exception of its own, and deliberately so — four in the morning is that
    // shift's ordinary time, not an anomaly. What it must not do is land on a
    // night rate, which packages/shared/test/overtime.spec.ts pins directly.
    for (const [code, count] of [
      ['MISSING_OUT', 4],
      ['WORKED_HOLIDAY', 30],
      ['WORKED_ON_LEAVE', 2],
      ['ABSENT_NO_LEAVE', 2],
    ] as const) {
      await expect(
        page.locator(`li[data-code="${code}"]`),
        `${code} should be among the exceptions`,
      ).toContainText(String(count));
    }

    // Nothing has been written: the "Imported" line is not there, and the
    // button that would write it still is.
    await expect(page.getByText('Imported. The worked days')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Import it' })).toBeEnabled();

    await page.context().close();
  });

  test('confirming writes the days, and says so', async ({ browser }) => {
    const page = await open(browser, 'hr', '/attendance/import');

    await tryTheSample(page);
    await page.getByRole('button', { name: 'Import it' }).click();

    // Thirty seconds, deliberately: a month of a company this size is written
    // in a few statements, and if this ever needs a minute again the batching
    // has come undone and somebody should hear about it before SMG does.
    await expect(page.getByText('Imported. The worked days')).toBeVisible({
      timeout: 30_000,
    });

    // It is in the trail, under the name of the file that carried it.
    await page.goto('/settings/audit');
    await expect(page.getByText(/Sample_Attendance_Export/).first()).toBeVisible();

    await page.context().close();
  });

  test('a file nobody can read is refused, with the reason on the line', async ({ browser }) => {
    const page = await open(browser, 'hr', '/attendance/import');

    await page.getByLabel('Paste the file').fill('name;when\nKarim;yesterday\n');
    await page.getByRole('button', { name: 'Try it' }).click();

    await expect(
      page.getByText('The first line does not name the columns we need'),
    ).toBeVisible();

    // And there is no way to write it.
    await expect(page.getByRole('button', { name: 'Import it' })).toBeDisabled();

    await page.context().close();
  });

  test('the same trial, opened again by its link, says the same thing', async ({ browser }) => {
    const page = await open(browser, 'hr', '/attendance/import');

    await tryTheSample(page);

    // The trial lives with its import row, so its address is worth keeping:
    // reloading it must not mean reading the file again by hand.
    const address = page.url();
    expect(address).toContain('import=');

    const punches = await figure(page, 'Punches');

    await page.goto(address);
    await expect(page.getByRole('heading', { name: 'What the file says' })).toBeVisible();
    expect(await figure(page, 'Punches')).toBe(punches);

    await page.context().close();
  });

  test('an employee cannot reach the import at all', async ({ browser }) => {
    const page = await open(browser, 'employee', '/attendance/import');

    await expect(page.getByText('Attendance is for HR and managers.')).toBeVisible();
    await expect(page.getByLabel('Paste the file')).toHaveCount(0);

    await page.context().close();
  });
});

/** Takes the sample the screen offers, pastes it in, and tries it. */
async function tryTheSample(page: Page): Promise<void> {
  // The sample the screen offers is the file the import reads: one document,
  // not two that might drift apart.
  const sample = await (await page.request.get('/attendance/sample.csv')).text();

  await page.getByLabel('What the file is called').fill('Sample_Attendance_Export_2026-11.csv');
  await page.getByLabel('Paste the file').fill(sample);
  await page.getByRole('button', { name: 'Try it' }).click();

  await expect(page.getByRole('heading', { name: 'What the file says' })).toBeVisible({
    timeout: 60_000,
  });
}

/** One of the trial's figures, as a number. */
async function figure(page: Page, label: string): Promise<number> {
  const text = await page
    .locator('dt', { hasText: new RegExp(`^${label}$`, 'i') })
    .locator('xpath=following-sibling::dd[1]')
    .innerText();

  return Number(text.replace(/[^\d]/g, ''));
}

/** Signed in, reading English, whatever their account prefers. */
async function open(browser: Browser, role: DemoRole, path: string): Promise<Page> {
  const page = await openAs(browser, role, { path });
  await useEnglish(page);
  return page;
}
