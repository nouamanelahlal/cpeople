import { expect, test, type Browser, type Page } from '@playwright/test';
import { openAs, useEnglish, type DemoRole } from './support/demo-users';

/**
 * The organisation chart (HR-01 spec 6.9).
 *
 * Two things matter about it: it draws 148 people without falling over, and a
 * manager's chart is their own branch rather than the company with holes in it.
 */

test.beforeEach(({ browserName: _browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser is enough.');
  testInfo.setTimeout(150_000);
});

test.describe('HR-01 organisation chart', () => {
  test.describe.configure({ mode: 'serial' });

  test('draws the whole company, and opens a person from it', async ({ browser }) => {
    const page = await open(browser, 'hr', '/org');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Organisation chart');
    await expect(page.getByText('148 people, by who they report to.')).toBeVisible();

    // One person at the top — the general manager, whoever the seed made them —
    // with the heads of department under them. Only the named cast is fixed, so
    // the test names only them.
    const top = page.locator('details').first();
    await expect(top).toContainText('General manager');
    await expect(top).toContainText('Rachid Kettani');
    await expect(page.getByRole('link', { name: 'Open Rachid Kettani' })).toBeVisible();

    // A branch closes and opens without any script.
    const branch = page.locator('details').first();
    await expect(branch).toHaveAttribute('open', '');

    // Searching jumps to the person, and the card opens their file.
    await page.getByLabel('Find a person').fill('Omar Chraibi');
    await page.getByRole('button', { name: 'Find a person' }).click();
    await page.getByRole('link', { name: 'Open Omar Chraibi' }).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Omar Chraibi');

    await page.context().close();
  });

  test('filters to one department', async ({ browser }) => {
    const page = await open(browser, 'hr', '/org');

    await page.getByLabel('Department').selectOption('KIT');
    await page.getByRole('button', { name: 'Find a person' }).click();

    await expect(page.getByText('46 people, by who they report to.')).toBeVisible();
    // Nobody from another department is on it.
    await expect(page.getByRole('link', { name: 'Open Salma Benali' })).toHaveCount(0);

    await page.context().close();
  });

  test('a manager’s chart is their own branch, beginning with them', async ({ browser }) => {
    const page = await open(browser, 'manager', '/org');

    await expect(page.getByText('Your branch of the organisation: 46 people.')).toBeVisible();

    // It starts with them, and nobody above them is on it: no general manager,
    // and nobody from another department.
    const first = page.locator('details').first();
    await expect(first).toContainText('Rachid Kettani');
    await expect(page.getByText('General manager')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Open Salma Benali' })).toHaveCount(0);

    await page.context().close();
  });
});

/** Signed in, reading English, whatever their account prefers. */
async function open(browser: Browser, role: DemoRole, path: string): Promise<Page> {
  const page = await openAs(browser, role, { path });
  await useEnglish(page);
  return page;
}
