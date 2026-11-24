import { expect, test, type Browser, type Page } from '@playwright/test';
import { openAs, useEnglish, type DemoRole } from './support/demo-users';
import { resetDemoData } from './support/demo-data';

/**
 * M10 attendance: the format, the sample and the specification
 * (HR-02 build spec §5.1, §5.2 and §5.7).
 *
 * Nothing here imports anything — that is the next step. What this step has to
 * get right is the thing SMG acts on first: a sample file that looks like a
 * device wrote it, carrying **exactly** the problems the import will have to
 * find, and a specification to send to the provider.
 *
 * And one thing it must not do: pretend to talk to a device.
 */

test.beforeEach(({ browserName: _browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser is enough.');
  testInfo.setTimeout(180_000);
});

test.beforeAll(({ browserName: _browserName }, testInfo) => {
  if (testInfo.project.name !== 'desktop-chromium') return;
  resetDemoData();
});

test.describe('M10 attendance source', () => {
  test.describe.configure({ mode: 'serial' });

  test('the sample is a file a device could have written', async ({ browser }) => {
    const page = await open(browser, 'hr', '/attendance');

    await expect(page.getByRole('heading', { name: 'Import a device file' })).toBeVisible();

    // Downloaded rather than described: the file itself is what SMG sends on.
    const download = await Promise.race([
      page.waitForEvent('download'),
      page.getByRole('link', { name: 'Download the sample export' }).click().then(() => null),
    ]);

    const response = await page.request.get('/attendance/sample.csv');
    expect(response.status()).toBe(200);

    const text = await response.text();
    const lines = text.trim().split(/\r?\n/);

    // The header the specification promises, in the order it promises it.
    expect(lines[0]?.replace(/^\uFEFF/, '')).toBe('employee_number;timestamp;direction;device_id');
    expect(lines.length).toBeGreaterThan(100);

    // Every row is four fields, and every timestamp is local time to the second.
    for (const line of lines.slice(1, 40)) {
      const cells = line.split(';');
      expect(cells).toHaveLength(4);
      expect(cells[1]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expect(['IN', 'OUT']).toContain(cells[2]);
    }

    void download;
    await page.context().close();
  });

  test('the sample carries the problems the import will have to find', async ({ browser }) => {
    const page = await open(browser, 'hr', '/attendance');

    const response = await page.request.get('/attendance/sample.csv');
    const text = await response.text();

    // Three numbers that match nobody, including the leading-zero variant that
    // is the open question about the employee-number format.
    expect(text).toContain('9001;');
    expect(text).toContain('9002;');
    expect(text).toMatch(/\n0\d+;/);

    // Night work: the pastry shift starts at four in the morning.
    expect(text).toMatch(/ 0[34]:\d{2}:\d{2};IN/);

    // Somebody worked the public holiday.
    expect(text).toContain('2026-11-18');

    // And the screen says the same things the file contains.
    await expect(page.getByText('numbers that match nobody', { exact: false })).toBeVisible();
    await expect(page.getByText('badged in and never badged out', { exact: false })).toBeVisible();
    await expect(page.getByText('a public holiday', { exact: false })).toBeVisible();

    await page.context().close();
  });

  test('the file specification downloads as a workbook', async ({ browser }) => {
    const page = await open(browser, 'hr', '/attendance');

    const response = await page.request.get('/attendance/specification.xlsx');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('spreadsheetml');

    // A real xlsx is a zip: it starts with "PK".
    const body = await response.body();
    expect(body.subarray(0, 2).toString()).toBe('PK');
    expect(body.length).toBeGreaterThan(5_000);

    await page.context().close();
  });

  test('the column mapping is a setting, not a release', async ({ browser }) => {
    const page = await open(browser, 'hr', '/settings/attendance');

    await expect(page.getByRole('heading', { name: 'Daily file' })).toBeVisible();

    // The provider calls it something else; we say so once and it is remembered.
    const column = page.getByRole('row').filter({ hasText: 'Employee number' }).getByRole('textbox');
    await column.fill('badge_no');
    await page.getByRole('button', { name: 'Save the mapping' }).click();

    await expect(page.getByText('Saved.', { exact: false })).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole('row').filter({ hasText: 'Employee number' }).getByRole('textbox'),
    ).toHaveValue('badge_no');

    // It is in the trail, like every other change of consequence.
    await page.goto('/settings/audit');
    await expect(page.getByRole('row').nth(1)).toContainText('Daily file');

    // Put it back.
    await page.goto('/settings/attendance');
    await page
      .getByRole('row')
      .filter({ hasText: 'Employee number' })
      .getByRole('textbox')
      .fill('employee_number');
    await page.getByRole('button', { name: 'Save the mapping' }).click();
    await expect(page.getByText('Saved.', { exact: false })).toBeVisible();

    await page.context().close();
  });

  test('the device API is shown switched off, not pretended at', async ({ browser }) => {
    const page = await open(browser, 'hr', '/settings/attendance');

    await expect(page.getByRole('heading', { name: 'Device API' })).toBeVisible();
    await expect(page.getByText('Planned', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Switched on when the device provider confirms', { exact: false }),
    ).toBeVisible();

    // Every one of its fields is disabled: nothing here can be pressed.
    for (const field of ['Address', 'Authentication', 'How often', 'Last sync']) {
      await expect(page.getByLabel(field)).toBeDisabled();
    }

    await page.context().close();
  });

  test('an employee cannot open attendance at all', async ({ browser }) => {
    const page = await open(browser, 'employee', '/attendance');

    await expect(page.getByText('Attendance is for HR and managers.').first()).toBeVisible();

    const refused = await page.request.get('/attendance/sample.csv');
    expect(refused.status()).toBe(403);

    await page.context().close();
  });
});

/** Signed in, reading English, whatever their account prefers. */
async function open(browser: Browser, role: DemoRole, path: string): Promise<Page> {
  const page = await openAs(browser, role, { path });
  await useEnglish(page);
  return page;
}
