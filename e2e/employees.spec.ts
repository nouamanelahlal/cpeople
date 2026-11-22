import { expect, test, type Page } from '@playwright/test';
import { openAs, saveSession, useEnglish } from './support/demo-users';
import { skipWithoutBaseline } from './support/snapshots';

/**
 * The employee list (HR-01 / HR-02, spec section 6.2).
 *
 * The figures are the seed's: 148 people, 46 of them in the kitchen, five with a
 * document expiring inside thirty days. They are assertions rather than
 * observations — the seed is deterministic, so a change in these numbers is a
 * change in the data, and this is where it gets noticed.
 */

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

test.beforeEach(({ browserName: _browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser is enough.');
});

test.beforeAll(async ({ browser }, testInfo) => {
  if (testInfo.project.name !== 'desktop-chromium') return;

  for (const role of ['hr', 'manager', 'employee'] as const) {
    await saveSession(browser, role);
  }
});

test.describe('HR-01 employee list', () => {
  test.describe.configure({ mode: 'serial' });

  test('lists the company a page at a time, and says where you are in it', async ({ browser }) => {
    const page = await open(browser, 'hr', '/employees');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Employees');
    await expect(page.getByText('148 employees')).toBeVisible();

    const rows = page.getByRole('row');
    // Twenty-five people and the header row.
    await expect(rows).toHaveCount(26);
    await expect(page.getByText('Showing 1 to 25 of 148')).toBeVisible();
    await expect(page.getByText('Page 1 of 6')).toBeVisible();

    // Every column the spec asks for. A column that can be sorted by carries its
    // arrow and how it is sorted in its name, so those are matched by their start.
    for (const column of ['Number', 'Position', 'Department', 'Contract', 'Status', 'Documents']) {
      await expect(
        page.getByRole('columnheader', { name: column, exact: true }),
        column,
      ).toBeVisible();
    }

    for (const column of [/^Name/, /^Contract end/]) {
      await expect(page.getByRole('columnheader', { name: column }), String(column)).toBeVisible();
    }

    // The next page is a link, so the address says where you are.
    await page.getByRole('link', { name: 'Next page' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText('Showing 26 to 50 of 148')).toBeVisible();

    await page.context().close();
  });

  test('opens pre-filtered from the home screen, and the count matches the card', async ({
    browser,
  }) => {
    const page = await open(browser, 'hr', '/home');

    const card = page
      .getByRole('region', { name: 'Today at a glance' })
      .getByRole('link')
      .nth(3);
    await expect(card).toContainText('5');
    await card.click();

    // The acceptance criterion from the spec: the card opens this list already
    // narrowed, and the two agree.
    await expect(page).toHaveURL(/filter=documents-expiring/);
    await expect(page.getByRole('row')).toHaveCount(6);
    await expect(page.getByText('5 of 148')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Documents expiring' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Each of the five says a document is running out, in words and not only in
    // colour.
    await expect(page.getByText('Expiring', { exact: true })).toHaveCount(5);

    await page.context().close();
  });

  test('finds a person by name and by employee number', async ({ browser }) => {
    const page = await open(browser, 'hr', '/employees');

    // Every word has to match something, so the surname alone finds the family
    // and the two words together find the person.
    await page.getByRole('searchbox', { name: 'Search employees' }).fill('chraibi');
    await page.keyboard.press('Enter');
    const family = await page.getByRole('row').count();
    expect(family).toBeGreaterThan(2);

    await page.getByRole('searchbox', { name: 'Search employees' }).fill('omar chraibi');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('row')).toHaveCount(2);

    const omar = page.getByRole('row').nth(1);
    await expect(omar).toContainText('Omar Chraibi');
    await expect(omar).toContainText('CDD');

    // His own number finds him, and nobody else.
    const number = (await omar.getByRole('cell').first().textContent())?.trim() ?? '';
    expect(number).not.toBe('');

    await page.getByRole('searchbox', { name: 'Search employees' }).fill(number);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('row')).toHaveCount(2);
    await expect(page.getByRole('row').nth(1)).toContainText('Omar Chraibi');

    // A search that matches nobody says so, and offers the way back.
    await page.getByRole('searchbox', { name: 'Search employees' }).fill('zzzz');
    await page.keyboard.press('Enter');
    await expect(page.getByText('No one matches these filters.')).toBeVisible();
    await page.getByRole('link', { name: 'Clear the filters' }).first().click();
    await expect(page.getByText('148 employees')).toBeVisible();

    await page.context().close();
  });

  test('filters by department and sorts by when a contract runs out', async ({ browser }) => {
    const page = await open(browser, 'hr', '/employees');

    await page.getByLabel('Department').selectOption('KIT');
    await expect(page).toHaveURL(/department=KIT/);
    await expect(page.getByText('46 of 148')).toBeVisible();
    await expect(page.getByText('Page 1 of 2')).toBeVisible();

    // The fixed terms that are running out, soonest first: Omar Chraibi's ends on
    // 30 November, which is the soonest in the company.
    await page.goto('/employees?view=contracts-ending&sort=contractEnd');
    await expect(page.getByRole('row').nth(1)).toContainText('Omar Chraibi');
    await expect(page.getByRole('row').nth(1)).toContainText('30 Nov 2026');
    await expect(page.getByRole('columnheader', { name: /^Contract end/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    await page.context().close();
  });

  test('shows each role the files they may see, and nobody else', async ({ browser }) => {
    // A manager: their own branch of the organisation, which is the kitchen.
    const manager = await open(browser, 'manager', '/employees');
    await expect(manager.getByText('46 employees')).toBeVisible();
    await expect(manager.getByRole('row')).toHaveCount(26);

    // Searching the rest of the company finds nothing, because it is not theirs
    // to search: the scope is applied in the API, not in the page.
    await manager.getByRole('searchbox', { name: 'Search employees' }).fill('Salma');
    await manager.keyboard.press('Enter');
    await expect(manager.getByText('No one matches these filters.')).toBeVisible();

    // And the national identifier is not something they may search by.
    await expect(
      manager.getByRole('searchbox', { name: 'Search employees' }),
    ).toHaveAttribute('placeholder', 'Name or employee number');
    await manager.context().close();

    // An employee: their own file.
    const employee = await open(browser, 'employee', '/employees');
    await expect(employee.getByText('1 employees')).toBeVisible();
    await expect(employee.getByRole('row')).toHaveCount(2);
    await expect(employee.getByRole('row').nth(1)).toContainText('Karim Alaoui');
    await employee.context().close();
  });

  test('lets HR search by national identifier, and says so', async ({ browser }) => {
    const page = await open(browser, 'hr', '/employees');

    await expect(page.getByRole('searchbox', { name: 'Search employees' })).toHaveAttribute(
      'placeholder',
      'Name, employee number or CIN',
    );
    await expect(page.getByText('A CIN is matched in full.')).toBeVisible();

    await page.context().close();
  });

  test('is usable on a phone', async ({ browser }) => {
    const page = await open(browser, 'hr', '/employees', PHONE);

    await expect(page.getByText('148 employees')).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(26);

    // The page itself never scrolls sideways; the table scrolls inside its card.
    const spill = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(spill).toBeLessThanOrEqual(0);

    await page.context().close();
  });

  test('matches the approved list, in English and in French', async ({ browser }, testInfo) => {
    test.skip(skipWithoutBaseline(testInfo), 'Pixel baselines are not gating.');

    const page = await open(browser, 'hr', '/employees', DESKTOP);
    await settle(page);
    await expect(page).toHaveScreenshot('employees-en-1440x900.png', { fullPage: true });

    await page.getByRole('button', { name: 'Language: Français' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Salariés');
    await settle(page);
    await expect(page).toHaveScreenshot('employees-fr-1440x900.png', { fullPage: true });

    await page.context().close();
  });
});

/** Signed in, reading English, whatever their account prefers. */
async function open(
  browser: Parameters<typeof openAs>[0],
  role: Parameters<typeof openAs>[1],
  path: string,
  viewport?: { width: number; height: number },
): Promise<Page> {
  const page = await openAs(browser, role, {
    path,
    ...(viewport ? { viewport } : {}),
  });

  await useEnglish(page);
  return page;
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForTimeout(250);
}
