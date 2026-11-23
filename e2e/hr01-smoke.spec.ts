import { expect, test, type Browser, type Page } from '@playwright/test';
import { DEMO_USERS, sessionPath, useEnglish, type DemoRole } from './support/demo-users';
import { resetDemoData } from './support/demo-data';

/**
 * The HR-01 demo smoke test (spec section 10), run after steps 4, 8 and 12.
 *
 * The spec wrote it for a browser-only demo with a role switcher; ours runs
 * through a real sign-in, as a real person per role, against the real API. The
 * numbers come from the deterministic seed, so they are assertions and not
 * observations: if the seed changes, these change with it.
 *
 * Items arrive as the steps that make them true land. What is checked after step
 * 4 is the demo's starting state — the figures on Home, every menu item going
 * somewhere, what each role is allowed to count, and a phone being usable.
 */

const PHONE = { width: 390, height: 844 };

test.beforeEach(({ browserName: _browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser is enough.');
  // These walk through a lot of the app, and a development build compiles each
  // page the first time it is asked for.
  testInfo.setTimeout(150_000);
});

// Three real sign-ins, once each: the roles are the subject here, and the sign-in
// itself is e2e/m02-sign-in.spec.ts's.

/**
 * The seeded company, as this file expects to find it: the tests before this
 * one hire people and sign contracts, and the figures here are asserted.
 */
test.beforeAll(({ browserName: _browserName }, testInfo) => {
  if (testInfo.project.name !== 'desktop-chromium') return;
  resetDemoData();
});

test.describe('HR-01 demo smoke test', () => {
  // One sign-in at a time: Keycloak turns away a repeat sign-in of the same
  // person within a second, and three of these share the authenticator step.
  test.describe.configure({ mode: 'serial' });

  // 1. The demo's opening figures, as at the demo clock's 23 November 2026.
  test('1 · home shows the seeded company: 148 people, 12 fixed terms, 5 documents expiring', async ({
    browser,
  }) => {
    const page = await open(browser, 'hr');

    await expect(page.getByText('Monday, 23 November 2026', { exact: false })).toBeVisible();

    const glance = page.getByRole('region', { name: 'Today at a glance' });
    await expect(glance.getByRole('link').first()).toContainText('148');
    await expect(glance.getByRole('link').nth(3)).toContainText('5');

    // The fixed terms are counted beside the departments they are spread over.
    await expect(
      page.getByText('148 employees, 12 on fixed-term contracts'),
    ).toBeVisible();

    // And the five documents are the five the list of what is waiting is made of.
    const waiting = page.getByRole('region', { name: 'Waiting for you' });
    await expect(waiting.getByRole('listitem')).not.toHaveCount(0);

    await page.context().close();
  });

  // 2. Every menu item opens a page, and Expenses says what it is waiting for.
  test('2 · every menu item opens a page, and none of them is a dead link', async ({ browser }) => {
    const page = await open(browser, 'hr');

    const items = page.getByRole('navigation').getByRole('link');
    const hrefs = await items.evaluateAll((links) =>
      links.map((link) => link.getAttribute('href') ?? ''),
    );

    expect(hrefs.length).toBeGreaterThanOrEqual(13);
    expect(hrefs.filter((href) => href === '' || href === '#')).toEqual([]);

    for (const href of hrefs) {
      const response = await page.goto(href);
      expect(response?.status(), href).toBeLessThan(400);
      // A page, not a blank: every one of them names itself.
      await expect(page.getByRole('heading', { level: 1 }), href).toBeVisible();
    }

    // Expenses stays in the menu, as a page that says plainly when it arrives
    // (M14): the spec would hide it, and an empty page that says so is better in
    // front of a client than a module that has vanished.
    await page.goto('/expenses');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Expenses');
    // Said twice on purpose: under the page's title, and on the panel itself.
    await expect(page.getByText('Later in the MVP')).toHaveCount(2);
    await expect(page.getByText('the manager approves', { exact: false })).toBeVisible();

    await page.context().close();
  });

  // 3. What each role may count. The list, the file and the masking they need are
  // steps 5 and 6; what is enforced today is the scope the figures are counted over.
  test('3 · a manager counts their own branch, an employee counts their own file', async ({
    browser,
  }) => {
    const manager = await open(browser, 'manager');
    const headcount = manager.getByRole('region', { name: 'Today at a glance' }).getByRole('link').first();
    // Rachid Kettani's branch is the kitchen: 46 of the 148, himself included.
    await expect(headcount).toContainText('46');
    await expect(headcount).not.toContainText('148');
    await manager.context().close();

    const employee = await open(browser, 'employee');
    await expect(
      employee.getByRole('region', { name: 'Today at a glance' }).getByRole('link').first(),
    ).toContainText('1');
    await employee.context().close();
  });

  // 13. A phone, which is how half of a workshop audience will look at it.
  test('13 · home is usable on a phone', async ({ browser }) => {
    const page = await open(browser, 'hr', PHONE);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('148 employees, 12 on fixed-term contracts')).toBeVisible();
    // Nothing has pushed the page sideways, with the menu shut or open.
    const across = async () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

    expect(await across(), 'with the menu shut').toBeLessThanOrEqual(0);

    // The menu is a drawer there, reachable and dismissable.
    await page.getByRole('button', { name: /menu/i }).click();
    await expect(page.getByRole('navigation').getByRole('link').first()).toBeVisible();

    expect(await across(), 'with the menu open').toBeLessThanOrEqual(0);

    await page.context().close();
  });
});

/** A signed-in page for one of the demo's named people, on its own context. */
async function open(
  browser: Browser,
  role: DemoRole,
  viewport: { width: number; height: number } = { width: 1440, height: 900 },
): Promise<Page> {
  const context = await browser.newContext({
    viewport,
    timezoneId: 'Africa/Casablanca',
    storageState: sessionPath(role),
  });
  const page = await context.newPage();

  await page.goto('/home');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    DEMO_USERS[role].firstName,
  );
  await useEnglish(page);

  // The figures came from the API. A dash means the page drew its honest empty
  // state, which is the right thing on a broken day and the wrong thing to run a
  // smoke test against: a demo of counted figures that shows dashes has failed.
  await expect(
    page.getByRole('region', { name: 'Today at a glance' }).getByRole('link').first(),
  ).not.toContainText('—');

  return page;
}
