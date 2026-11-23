import { expect, test, type Browser, type Page } from '@playwright/test';
import { openAs, useEnglish, type DemoRole } from './support/demo-users';

/**
 * One employee's file, and the trail behind it (HR-01 spec 6.3 and 6.11).
 *
 * The questions worth asking of it are about who sees what: HR sees the whole
 * file, a manager sees their team's files without the pay, the identifiers, the
 * address or the family, and an employee sees their own. The masked values are
 * checked by looking for the real ones in the page, because "masked" here means
 * never sent — not hidden with a style.
 */

test.beforeEach(({ browserName: _browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser is enough.');
  // These walk through a lot of the app, and a development build compiles each
  // page the first time it is asked for.
  testInfo.setTimeout(150_000);
});


test.describe('HR-01 employee file', () => {
  test.describe.configure({ mode: 'serial' });

  test('opens from the list and shows the whole file to HR', async ({ browser }) => {
    const page = await open(browser, 'hr', '/employees?q=karim%20alaoui');

    await page.getByRole('link', { name: 'Open Karim Alaoui' }).click();
    await expect(page).toHaveURL(/\/employees\/[0-9a-f-]{36}$/);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Karim Alaoui');

    // The tabs the spec asks for, as links. Scoped to the file's own navigation:
    // the menu down the side has a "Contracts" of its own.
    const tabs = page.getByRole('navigation', { name: 'File sections' });
    for (const tab of [
      'Overview',
      'Job and organisation',
      'Pay and bank',
      'Family',
      'Contracts',
      'History',
    ]) {
      await expect(tabs.getByRole('link', { name: tab, exact: true })).toBeVisible();
    }

    // Identity, including the parts only HR sees.
    await expect(page.getByText('CIN', { exact: true })).toBeVisible();
    await expect(page.getByRole('definition').filter({ hasText: '••••' })).toHaveCount(0);

    // The job tab computes seniority rather than storing it.
    await tab(page, 'Job and organisation');
    await expect(page.getByText('Seniority', { exact: true })).toBeVisible();
    await expect(page.getByText('Cost centre', { exact: true })).toBeVisible();

    // The pay tab says what it is for, and shows the money.
    await tab(page, 'Pay and bank');
    await expect(page.getByText('Used by payroll — workshop HR-03.')).toBeVisible();
    await expect(page.getByText('MAD', { exact: false }).first()).toBeVisible();

    // The contract history is on the file.
    await tab(page, 'Contracts');
    await expect(page.getByText(/No end date|From /).first()).toBeVisible();

    await page.context().close();
  });

  test('never sends a manager the pay, the identifiers or the address', async ({ browser }) => {
    // What HR can see, so the manager's page can be checked for it.
    const hr = await open(browser, 'hr', '/employees?q=karim%20alaoui');
    const file = await hr.getByRole('link', { name: 'Open Karim Alaoui' }).getAttribute('href');
    expect(file).not.toBeNull();

    await hr.goto(`${file}?tab=pay`);
    const salary = await fieldValue(hr, 'Base salary, monthly');
    expect(salary).toMatch(/\d/);

    await hr.goto(`${file}`);
    const cin = await fieldValue(hr, 'CIN');
    expect(cin).not.toBe('');
    await hr.context().close();

    // The same file, read by the manager whose team he is in.
    const manager = await open(browser, 'manager', `${file}?tab=pay`);
    await expect(manager.getByRole('heading', { level: 1 })).toHaveText('Karim Alaoui');

    const payPage = await manager.content();
    expect(payPage).not.toContain(salary);
    expect(payPage).toContain('••••');

    await manager.goto(`${file}`);
    expect(await manager.content()).not.toContain(cin);
    await expect(
      manager.getByText('Pay, identifiers, address and family are not part of what a manager sees.'),
    ).toBeVisible();

    // And nothing on the file offers them a way to change it.
    await expect(manager.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);

    await manager.context().close();
  });

  test('a file outside a manager’s team is simply not there', async ({ browser }) => {
    const hr = await open(browser, 'hr', '/employees?q=salma%20benali');
    const file = await hr.getByRole('link', { name: 'Open Salma Benali' }).getAttribute('href');
    await hr.context().close();

    const manager = await open(browser, 'manager', String(file));
    // Not "you may not": whether she works here is not theirs to learn.
    await expect(manager.getByRole('heading', { level: 1 })).toHaveText('No such employee file.');

    await manager.context().close();
  });

  test('HR changes a salary, and the history says so', async ({ browser }) => {
    const page = await open(browser, 'hr', '/employees?q=karim%20alaoui');
    await page.getByRole('link', { name: 'Open Karim Alaoui' }).click();

    await tab(page, 'Pay and bank');
    const before = await fieldValue(page, 'Base salary, monthly');

    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    const salary = page.getByLabel('Base salary, monthly');
    const was = await salary.inputValue();
    const now = (Number.parseFloat(was) + 500).toFixed(2);

    await salary.fill(now);
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Saved. The change is in the history.')).toBeVisible();
    expect(await fieldValue(page, 'Base salary, monthly')).not.toBe(before);

    // The trail: the field, both values, and who did it in which role.
    await tab(page, 'History');
    const entry = page.getByRole('listitem').first();
    await expect(entry).toContainText('Base salary, monthly');
    await expect(entry).toContainText(before.replace(/\s/g, ' '));
    await expect(entry).toContainText('Salma Benali, HR administrator');

    // Put it back, so the next run starts where this one did.
    await tab(page, 'Pay and bank');
    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await page.getByLabel('Base salary, monthly').fill(was);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved. The change is in the history.')).toBeVisible();

    await page.context().close();
  });

  test('a manager sees that a salary changed, and not what to', async ({ browser }) => {
    const hr = await open(browser, 'hr', '/employees?q=karim%20alaoui');
    const file = await hr.getByRole('link', { name: 'Open Karim Alaoui' }).getAttribute('href');
    await hr.context().close();

    const manager = await open(browser, 'manager', `${file}?tab=history`);
    const entry = manager.getByRole('listitem').first();

    await expect(entry).toContainText('Base salary, monthly');
    await expect(entry).toContainText('••••');
    // The figures themselves are not in the page at all.
    expect(await manager.content()).not.toMatch(/Base salary, monthly: [\d\s.,]*\d/);

    await manager.context().close();
  });

  test('an employee reads their own file and corrects their own contact details', async ({
    browser,
  }) => {
    const page = await open(browser, 'employee', '/employees');

    await page.getByRole('link', { name: 'Open Karim Alaoui' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Karim Alaoui');

    // Their own file, so their own salary is theirs to see.
    await tab(page, 'Pay and bank');
    expect(await page.content()).not.toContain('••••');

    // What they may change is their contact details, and that is what the
    // button says.
    await tab(page, 'Overview');
    await page.getByRole('link', { name: 'Correct my contact details' }).click();

    await expect(page.getByLabel('Phone')).toBeVisible();
    await expect(page.getByLabel('First name')).toHaveCount(0);

    const phone = page.getByLabel('Phone');
    const was = await phone.inputValue();
    await phone.fill('+212 600 112 233');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved. The change is in the history.')).toBeVisible();
    await expect(page.getByText('+212 600 112 233')).toBeVisible();

    await tab(page, 'Overview');
    await page.getByRole('link', { name: 'Correct my contact details' }).click();
    await page.getByLabel('Phone').fill(was);
    await page.getByRole('button', { name: 'Save' }).click();

    await page.context().close();
  });
});

/** What one field of the file says, found by the name beside it. */
async function fieldValue(page: Page, label: string): Promise<string> {
  const value = page
    .locator('dt', { hasText: new RegExp(`^${label}$`) })
    .locator('xpath=following-sibling::dd[1]')
    .first();

  return (await value.textContent())?.trim() ?? '';
}

/**
 * Opens one of the file's own tabs and waits until it is the one on screen.
 *
 * The tabs are links, so this clicks one like a person would — and then waits for
 * the address to say the move happened, rather than asking the next question of
 * whichever page is still on screen.
 */
async function tab(page: Page, name: string): Promise<void> {
  const link = page.getByRole('navigation', { name: 'File sections' }).getByRole('link', { name });
  const href = await link.getAttribute('href');

  await link.click();
  await page.waitForURL(`**${href}`, { timeout: 30_000 });
}

/** Signed in, reading English, whatever their account prefers. */
async function open(browser: Browser, role: DemoRole, path: string): Promise<Page> {
  const page = await openAs(browser, role, { path });
  await useEnglish(page);
  return page;
}
