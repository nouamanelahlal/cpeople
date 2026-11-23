import { expect, test, type Browser, type Page } from '@playwright/test';
import { openAs, useEnglish, type DemoRole } from './support/demo-users';
import { resetDemoData } from './support/demo-data';

/**
 * M08 leave set-up (HR-02 step 1).
 *
 * The claim this screen makes is narrow and worth testing exactly: every figure
 * behind leave arrived as data, says whether anybody has confirmed it, and keeps
 * its history when it changes. Nothing here is law — and the screen has to keep
 * saying so until SMG and the payroll expert have been through it.
 *
 * So these tests check four things: that HR can read all five tabs and sees
 * "to be confirmed" on every row; that changing a rule writes a new row and
 * leaves the old one on file; that a public holiday is entered rather than
 * calculated; and that none of it is a manager's to read or to change.
 */

test.beforeEach(({ browserName: _browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser is enough.');
  testInfo.setTimeout(150_000);
});

/** This file changes rules and holidays, so it starts from the seed. */
test.beforeAll(({ browserName: _browserName }, testInfo) => {
  if (testInfo.project.name !== 'desktop-chromium') return;
  resetDemoData();
});

/** And leaves the company as the demo expects to find it. */
test.afterAll(({ browserName: _browserName }, testInfo) => {
  if (testInfo.project.name !== 'desktop-chromium') return;
  resetDemoData();
});

/** The settings hub's card: titled and described in one accessible name. */
const LEAVE_CARD = /^Leave Leave types/;

test.describe('M08 leave set-up', () => {
  test.describe.configure({ mode: 'serial' });

  test('reads as five tabs of data, none of it confirmed yet', async ({ browser }) => {
    const page = await open(browser, 'hr', '/settings');

    // Reached from the settings hub, like every other piece of set-up. The card
    // is named by its note as well as its title, and the sidebar has a Leave of
    // its own, so the card is addressed by both.
    await page.getByRole('main').getByRole('link', { name: LEAVE_CARD }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Leave');

    // The warning that governs the whole screen.
    await expect(page.getByText('Nothing here is a legal value.')).toBeVisible();

    for (const tab of ['Leave types', 'Rules', 'Working week', 'Public holidays', 'Policy']) {
      await expect(page.getByRole('link', { name: tab })).toBeVisible();
    }

    // What a type *is*: the switches SMG answers, in the language of the reader
    // rather than the code it was seeded under.
    const annual = row(page, 'Annual leave');
    await expect(annual).toContainText('Working days');

    // Sick leave is the one counted in calendar days and needing a certificate.
    const sick = row(page, 'Sick leave');
    await expect(sick).toContainText('Calendar days');

    // Unpaid leave goes up the line (open point 2).
    await expect(row(page, 'Unpaid leave')).toBeVisible();

    // Rules: a figure, a date it applies from, and a state.
    await page.getByRole('link', { name: 'Rules' }).click();
    await expect(page).toHaveURL(/\/settings\/leave\?tab=rules$/);

    const rule = row(page, 'Annual leave');
    await expect(rule).toContainText('18');
    await expect(rule).toContainText('1.5');
    await expect(rule).toContainText('To be confirmed');

    // The working week is per site, because the outlet trades on Saturday.
    await page.getByRole('link', { name: 'Working week' }).click();
    await expect(row(page, 'Outlet')).toContainText('Sat');
    await expect(row(page, 'Head office')).not.toContainText('Sat');

    // Holidays are entered, and the list says what it does not contain.
    await page.getByRole('link', { name: 'Public holidays' }).click();
    await expect(page.getByText('The moveable religious holidays are not in this list.')).toBeVisible();
    await expect(row(page, 'Independence Day')).toContainText('To be confirmed');

    // And the two decisions that belong to the company.
    await page.getByRole('link', { name: 'Policy' }).click();
    await expect(page.getByLabel(/Warn when more than this share/)).toHaveValue('33');
    await expect(page.getByLabel('The leave year starts on')).toHaveValue('01-01');

    await page.context().close();
  });

  test('a changed rule is a new rule, and the old one stays on file', async ({ browser }) => {
    const page = await open(browser, 'hr', '/settings/leave?tab=rules');

    await row(page, 'Annual leave').getByRole('link', { name: 'Change' }).click();
    await expect(page.getByRole('heading', { name: 'Change the rule for Annual leave' })).toBeVisible();

    // What was there before this test: kept, so the history can be recognised.
    await expect(page.getByLabel('Days a year')).toHaveValue('18');
    await expect(page.getByText('1 Jan 2026')).toBeVisible();

    // A decision taken at the workshop: 21 days from the new leave year, said
    // to be agreed rather than assumed.
    await page.getByLabel('From', { exact: true }).fill('2027-01-01');
    await page.getByLabel('Days a year').fill('21');
    await page.getByLabel('Earned per month').fill('1.75');
    await page.getByLabel('Note').fill('Agreed with SMG at the HR-02 workshop.');
    await page.getByLabel('Mark as confirmed').check();
    await page.getByRole('button', { name: 'Save the new rule' }).click();

    await expect(page.getByText('Saved.')).toBeVisible();

    // Today is still 2026, so the figure in force is still the old one. That is
    // the whole point of an effective date: a change next year does not change
    // this year.
    const rule = row(page, 'Annual leave');
    await expect(rule).toContainText('18');
    await expect(rule).toContainText('1 Jan 2026');

    // Both rows are on file, the old one now closed, the new one confirmed.
    await rule.getByRole('link', { name: 'Change' }).click();

    const history = page.getByRole('listitem').filter({ hasText: '1 Jan 2027' });
    await expect(history).toContainText('21');
    await expect(history).toContainText('Confirmed');

    const earlier = page.getByRole('listitem').filter({ hasText: '1 Jan 2026' });
    await expect(earlier).toContainText('18');
    await expect(earlier).toContainText('Until 31 Dec 2026');

    await page.context().close();
  });

  test('a moveable holiday is entered by hand, and can be taken back out', async ({ browser }) => {
    const page = await open(browser, 'hr', '/settings/leave?tab=holidays&year=2027');

    // Aid Al Fitr moves with the lunar calendar, so the application never
    // guesses it: somebody is told the date and types it in.
    await page.getByLabel('Date').fill('2027-03-20');
    await page.getByLabel('Name').fill('Aid Al Fitr');
    await page.getByRole('button', { name: 'Add it' }).click();

    const added = row(page, 'Aid Al Fitr');
    await expect(added).toContainText('20 Mar 2027');
    await expect(added).toContainText('Sat');
    await expect(added).toContainText('To be confirmed');

    // Confirming the year is one decision, taken once, for the whole list.
    await page.getByRole('button', { name: 'Confirm all of 2027' }).click();
    await expect(row(page, 'Aid Al Fitr')).toContainText('Confirmed');
    await expect(row(page, 'Throne Day')).toContainText('Confirmed');

    // And 2026 is untouched: confirming a year confirms that year.
    await page.getByLabel('Year').selectOption('2026');
    await page.getByRole('button', { name: 'Show' }).click();
    await expect(row(page, 'Independence Day')).toContainText('To be confirmed');

    // A wrong date would quietly change what every request costs, so it has to
    // be removable.
    await page.goto('/settings/leave?tab=holidays&year=2027');
    await row(page, 'Aid Al Fitr').getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Aid Al Fitr' })).toHaveCount(0);

    await page.context().close();
  });

  test('is not a manager’s, on the screen or in the API', async ({ browser }) => {
    const page = await open(browser, 'manager', '/settings/leave');

    await expect(page.getByText('Leave set-up is for HR and administrators.').first()).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);

    // And it is not drawn differently: that sentence is what the screen shows
    // when the API has refused the request, which is the only way it can get
    // the data at all. The hub does not offer it either.
    await page.goto('/settings');
    await expect(page.getByRole('main').getByRole('link', { name: LEAVE_CARD })).toHaveCount(0);

    await page.context().close();
  });
});

/** The table row about one thing, found by what it is called. */
function row(page: Page, name: string) {
  return page.getByRole('row').filter({ hasText: name }).first();
}

/** Signed in, reading English, whatever their account prefers. */
async function open(browser: Browser, role: DemoRole, path: string): Promise<Page> {
  const page = await openAs(browser, role, { path });
  await useEnglish(page);
  return page;
}
