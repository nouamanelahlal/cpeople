import { expect, test, type Browser, type Page } from '@playwright/test';
import { openAs, useEnglish, type DemoRole } from './support/demo-users';

/**
 * Settings: roles and the audit log (HR-01 spec 5 and 6.11).
 *
 * These two open the demo at 13:30 — the matrix to say what the roles are, the
 * log to show that what was just done was recorded. Both are read-only for now;
 * the filters on the log arrive with step 13.
 */

test.beforeEach(({ browserName: _browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser is enough.');
  testInfo.setTimeout(150_000);
});

test.describe('HR-01 settings', () => {
  test.describe.configure({ mode: 'serial' });

  test('shows the access matrix as a proposal, drawn from what is enforced', async ({
    browser,
  }) => {
    const page = await open(browser, 'hr', '/settings');

    await expect(page.getByRole('link', { name: 'Roles and access' })).toBeVisible();
    await page.getByRole('link', { name: 'Roles and access' }).click();

    // It says what it is: a question for the workshop, not a decision taken.
    await expect(page.getByText('Proposed — to confirm with SMG')).toBeVisible();

    // One column per role, one row per thing someone may do.
    for (const role of ['Platform administrator', 'HR administrator', 'Manager', 'Employee']) {
      await expect(page.getByRole('columnheader', { name: role })).toBeVisible();
    }

    // The two cells the demo turns on: a manager sees their own team, and none
    // of its private fields.
    const list = page.getByRole('row').filter({ hasText: 'See the employee list' });
    await expect(list).toContainText('Own team');

    const sensitive = page.getByRole('row').filter({ hasText: 'See private fields' });
    await expect(sensitive).toContainText('Masked');

    // Settings themselves are not a manager's.
    const audit = page.getByRole('row').filter({ hasText: 'Audit log' });
    await expect(audit.getByText('Yes')).toHaveCount(2);

    await page.context().close();
  });

  test('lists what has been done, newest first, and links to the file', async ({ browser }) => {
    // Something to find: a change, made now.
    const page = await open(browser, 'hr', '/employees?q=nadia%20berrada');
    await page.getByRole('link', { name: 'Open Nadia Berrada' }).click();
    await page.getByRole('link', { name: 'Edit', exact: true }).click();

    const phone = page.getByLabel('Phone');
    const was = await phone.inputValue();
    await phone.fill('+212 600 998 877');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved. The change is in the history.')).toBeVisible();

    await page.goto('/settings/audit');

    const first = page.getByRole('row').nth(1);
    await expect(first).toContainText('Changed an employee file');
    await expect(first).toContainText('Salma Benali');
    await expect(first).toContainText('Nadia Berrada');
    await expect(first).toContainText('+212 600 998 877');

    // The entry opens the file it is about.
    await first.getByRole('link', { name: 'Nadia Berrada' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nadia Berrada');

    // Put it back, so the demo opens where it always does.
    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await page.getByLabel('Phone').fill(was);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved. The change is in the history.')).toBeVisible();

    await page.context().close();
  });

  test('is not a manager’s to read', async ({ browser }) => {
    const page = await open(browser, 'manager', '/settings');

    // Said twice: as the page's own subtitle and on the panel.
    await expect(page.getByText('Settings are for HR and administrators.').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Roles and access' })).toHaveCount(0);

    // And the audit log refuses them even when asked for directly.
    await page.goto('/settings/audit');
    await expect(page.getByText('Settings are for HR and administrators.').first()).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);

    await page.context().close();
  });
});

/** Signed in, reading English, whatever their account prefers. */
async function open(browser: Browser, role: DemoRole, path: string): Promise<Page> {
  const page = await openAs(browser, role, { path });
  await useEnglish(page);
  return page;
}
