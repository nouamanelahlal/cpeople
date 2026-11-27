import { expect, test, type Browser, type Page } from '@playwright/test';
import { openAs, useEnglish, type DemoRole } from './support/demo-users';
import { resetDemoData } from './support/demo-data';

/**
 * The organisation, and the cost centres it costs against (HR-01 spec 6.5).
 *
 * The acceptance criterion is the cascade: change the kitchen's cost centre, be
 * asked whether its people follow, and find the answer in the audit log. Payroll
 * is posted to SAP by cost centre, so this is the screen where a mistake becomes
 * money in the wrong place.
 */

test.beforeEach(({ browserName: _browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser is enough.');
  testInfo.setTimeout(150_000);
});

/**
 * This file **moves a cost centre**, and the test that moves it is the one that
 * moves it back. That is fine until the day it fails in between — and then the
 * kitchen is left costing against the wrong centre, in a database every later
 * run and every demo reads. It happened: a run failed here, and the next run
 * failed on a different test that was only asserting the seeded value.
 *
 * So the data is put back before and after, the way every other file that
 * changes something does it. A test that fails should cost one red test, not
 * every red test that follows it.
 */
test.beforeAll(({ browserName: _browserName }, testInfo) => {
  if (testInfo.project.name !== 'desktop-chromium') return;
  resetDemoData();
});

test.afterAll(({ browserName: _browserName }, testInfo) => {
  if (testInfo.project.name !== 'desktop-chromium') return;
  resetDemoData();
});

test.describe('HR-01 organisation', () => {
  test.describe.configure({ mode: 'serial' });

  test('shows the departments, the positions, the cost centres and the mapping', async ({
    browser,
  }) => {
    const page = await open(browser, 'hr', '/settings/organisation');

    // Departments, with their cost centre and who heads them.
    const kitchen = page.getByRole('row').filter({ hasText: 'Kitchen' }).first();
    await expect(kitchen).toContainText('CC-KIT');
    await expect(kitchen).toContainText('Rachid Kettani');

    await page.goto('/settings/organisation?tab=costCentres');
    // The SAP column is empty on purpose, and says what has to happen to it.
    await expect(page.getByText('To map with Finance').first()).toBeVisible();

    await page.goto('/settings/organisation?tab=positions');
    await expect(page.getByRole('row').filter({ hasText: 'Kitchen team member' })).not.toHaveCount(
      0,
    );

    // The mapping view: one row per department, and what is wrong with it.
    await page.goto('/settings/organisation?tab=mapping');
    await expect(page.getByText('In order').first()).toBeVisible();

    // HR reads it; changing it is an administrator's.
    await expect(
      page.getByText('The organisation is changed by an administrator.', { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Change' })).toHaveCount(0);

    await page.context().close();
  });

  test('an administrator moves a cost centre, and its people follow', async ({ browser }) => {
    const page = await open(browser, 'admin', '/settings/organisation?tab=mapping');

    const kitchen = page.getByRole('row').filter({ hasText: 'Kitchen' }).first();
    await kitchen.getByRole('link', { name: 'Change' }).click();

    // Nothing is asked until something is actually moving.
    await expect(page.getByText('Apply to', { exact: false })).toHaveCount(0);

    // Retried until the question appears: choosing before the page has finished
    // hydrating changes the field without the form noticing.
    await expect(async () => {
      await page.getByLabel('Cost centre').selectOption('CC-ADM');
      await expect(page.getByText('Apply to', { exact: false })).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Save the change' }).click();

    // It says how many followed, which is everyone in the kitchen without a
    // cost centre of their own.
    await expect(page.getByText('followed the new cost centre', { exact: false })).toBeVisible();

    // The trail has it.
    await page.goto('/settings/audit');
    const entry = page.getByRole('row').nth(1);
    await expect(entry).toContainText('Changed the organisation');
    await expect(entry).toContainText('costCentre');

    // Put the kitchen back where it belongs.
    await page.goto('/settings/organisation?tab=mapping');
    await page.getByRole('row').filter({ hasText: 'Kitchen' }).first().getByRole('link', { name: 'Change' }).click();
    await expect(async () => {
      await page.getByLabel('Cost centre').selectOption('CC-KIT');
      await expect(page.getByText('Apply to', { exact: false })).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Save the change' }).click();
    await expect(page.getByText('followed the new cost centre', { exact: false })).toBeVisible();

    await page.context().close();
  });
});

/** Signed in, reading English, whatever their account prefers. */
async function open(browser: Browser, role: DemoRole, path: string): Promise<Page> {
  const page = await openAs(browser, role, { path });
  await useEnglish(page);
  return page;
}
