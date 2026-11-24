import { expect, test, type Browser, type Page } from '@playwright/test';
import { openAs, useEnglish, type DemoRole } from './support/demo-users';
import { resetDemoData } from './support/demo-data';

/**
 * M09 the leave calendar, and the home figures behind it (HR-02 build spec
 * §4.3 and §8).
 *
 * One claim, tested three ways: **the month, the home card and the figure on
 * the home screen are the same data**. A calendar that disagreed with "Away
 * this week" would be two answers to one question, and the workshop would
 * believe neither.
 *
 * And one rule about privacy: an employee sees that a colleague is away. They
 * do not see what kind of leave it is, unless the company has said they may.
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

test.describe('M09 leave calendar', () => {
  test.describe.configure({ mode: 'serial' });

  test('the home screen counts the people the calendar draws', async ({ browser }) => {
    const page = await open(browser, 'hr', '/home');

    // Four people are off during the demo week, from the seed.
    const away = page.getByRole('region', { name: 'Away this week' });
    await expect(away).toBeVisible();

    const names = await away.getByRole('listitem').allTextContents();
    expect(names.length).toBeGreaterThanOrEqual(4);

    // And the figure beside it is the requests waiting for a decision: six.
    const kpi = page.getByRole('link').filter({ hasText: 'Leave requests' }).first();
    await expect(kpi).toContainText('6');

    // The figure opens the list it counted.
    await kpi.click();
    await expect(page).toHaveURL(/\/leave\?tab=all/);

    await page.context().close();
  });

  test('the month shows who is away, with a letter and not only a colour', async ({ browser }) => {
    const page = await open(browser, 'hr', '/leave?tab=calendar');

    await expect(page.getByRole('heading', { name: 'Leave calendar' })).toBeVisible();

    // Karim's approved annual leave carries the type's initial.
    const karim = page.getByRole('row').filter({ hasText: 'Karim Alaoui' }).first();
    await expect(karim).toContainText('A');

    // 18 November is a public holiday, and the column says so.
    await expect(page.getByRole('columnheader', { name: '18' })).toHaveAttribute(
      'title',
      'Independence Day',
    );

    // The legend is in words, so the screen survives being printed in grey.
    await expect(page.getByText('Hatched: waiting for a decision')).toBeVisible();
    await expect(page.getByText('½ : half a day')).toBeVisible();

    // A month that is not this one can be asked for.
    await page.getByLabel('Month').fill('2026-12');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page).toHaveURL(/month=2026-12/);

    // December holds Karim's pending December request, drawn as pending.
    const december = page.getByRole('row').filter({ hasText: 'Karim Alaoui' }).first();
    await expect(december).toContainText('A');

    await page.context().close();
  });

  test('an employee sees that a colleague is away, not why', async ({ browser }) => {
    const page = await open(browser, 'employee', '/leave?tab=calendar');

    await expect(
      page.getByText('Which kind of leave it is is not shown', { exact: false }),
    ).toBeVisible();

    // A dot, not a letter: the absence is there and the reason is not. The
    // cells are checked rather than the row, because the name itself has
    // letters in it.
    const row = page.getByRole('row').filter({ hasText: 'Karim Alaoui' }).first();
    const marks = (await row.getByRole('cell').allTextContents())
      .map((text) => text.trim())
      .filter((text) => text !== '');

    expect(marks.length).toBeGreaterThan(0);
    expect(marks.every((mark) => mark === '•' || mark === '½')).toBe(true);

    await page.context().close();
  });

  test('the company can decide colleagues may see the kind of leave', async ({ browser }) => {
    const hr = await open(browser, 'hr', '/settings/self-service');

    await hr.getByLabel('Colleagues’ absences name the kind of leave').check();
    await hr.getByRole('button', { name: 'Save the settings' }).click();
    await expect(hr.getByText('Saved.', { exact: false })).toBeVisible();
    await hr.context().close();

    // The same employee, the same screen, a different answer — decided by the
    // API, which is where the setting is enforced.
    const page = await open(browser, 'employee', '/leave?tab=calendar');
    const row = page.getByRole('row').filter({ hasText: 'Karim Alaoui' }).first();
    await expect(row).toContainText('A');

    await page.context().close();

    // Put it back, so the demo opens where it always does.
    const back = await open(browser, 'hr', '/settings/self-service');
    await back.getByLabel('Colleagues’ absences name the kind of leave').uncheck();
    await back.getByRole('button', { name: 'Save the settings' }).click();
    await expect(back.getByText('Saved.', { exact: false })).toBeVisible();
    await back.context().close();
  });

  test('an employee is not sent their own salary unless the company says so', async ({
    browser,
  }) => {
    // The setting is off by default, so the figure is absent from the answer —
    // not hidden in the page, absent from it.
    const page = await open(browser, 'employee', '/employees');
    await page.getByRole('link', { name: 'Open Karim Alaoui' }).click();
    await page.getByRole('link', { name: 'Pay and bank' }).click();

    await expect(page.getByText('••••').first()).toBeVisible();
    await page.context().close();

    const hr = await open(browser, 'hr', '/settings/self-service');
    await hr.getByLabel('Employees can see their base salary').check();
    await hr.getByRole('button', { name: 'Save the settings' }).click();
    await expect(hr.getByText('Saved.', { exact: false })).toBeVisible();
    await hr.context().close();

    const again = await open(browser, 'employee', '/employees');
    await again.getByRole('link', { name: 'Open Karim Alaoui' }).click();
    await again.getByRole('link', { name: 'Pay and bank' }).click();

    await expect(again.getByText('MAD', { exact: false }).first()).toBeVisible();
    await again.context().close();

    const back = await open(browser, 'hr', '/settings/self-service');
    await back.getByLabel('Employees can see their base salary').uncheck();
    await back.getByRole('button', { name: 'Save the settings' }).click();
    await expect(back.getByText('Saved.', { exact: false })).toBeVisible();
    await back.context().close();
  });
});

/** Signed in, reading English, whatever their account prefers. */
async function open(browser: Browser, role: DemoRole, path: string): Promise<Page> {
  const page = await openAs(browser, role, { path });
  await useEnglish(page);
  return page;
}
