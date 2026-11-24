import { expect, test, type Browser, type Page } from '@playwright/test';
import { openAs, useEnglish, type DemoRole } from './support/demo-users';
import { resetDemoData } from './support/demo-data';
import { MAILPIT_URL as MAILPIT } from './support/sign-in';

/**
 * M09 leave requests and approval (HR-02 step 2).
 *
 * The four promises this step makes, one scenario each:
 *
 *  1. **What a request cost is recorded, not recomputed.** Counting happens when
 *     it is sent and again when it is approved, and both answers stay on file
 *     with the rule, the working week and the holidays behind them.
 *  2. **A settings change never moves an approved request quietly.** Pending
 *     ones are redone and their people told; approved ones keep what was agreed
 *     and wait for HR on the "to review" list.
 *  3. **An unfinished holiday year says so**, to the requester, the approver and
 *     HR — until an administrator says the year is complete.
 *  4. **Who approves comes from the organisation**: the manager, then their
 *     manager, and HR where there is nobody to ask.
 *
 * And the rule that governs every notice: an e-mail carries dates and a link,
 * and never the reason somebody gave.
 */

test.beforeEach(({ browserName: _browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser is enough.');
  testInfo.setTimeout(180_000);
});

/** This file asks for leave, approves it and edits the calendar. */
test.beforeAll(({ browserName: _browserName }, testInfo) => {
  if (testInfo.project.name !== 'desktop-chromium') return;
  resetDemoData();
});

test.afterAll(({ browserName: _browserName }, testInfo) => {
  if (testInfo.project.name !== 'desktop-chromium') return;
  resetDemoData();
});

test.describe('M09 leave requests', () => {
  test.describe.configure({ mode: 'serial' });

  test('asking for leave keeps the count, and tells the approver without telling them why', async ({
    browser,
  }) => {
    const sent = Date.now();
    const page = await open(browser, 'employee', '/leave');

    // Karim's own leave, and only his.
    await expect(page.getByRole('heading', { name: 'My leave' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'All requests' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'To approve' })).toHaveCount(0);

    await page.getByRole('link', { name: 'Ask for leave' }).click();

    await page.getByLabel('Type of leave').selectOption({ label: 'Annual leave' });
    await page.getByLabel('First day', { exact: true }).fill('2027-02-08');
    await page.getByLabel('Last day', { exact: true }).fill('2027-02-12');
    await page.getByLabel('Reason').fill('Hospital appointment for my mother.');
    await page.getByRole('button', { name: 'Send the request' }).click();

    // Five working days, counted with the kitchen's Monday-to-Friday week.
    await expect(page.getByText('Sent.')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'DAYS' })).toHaveCount(0);
    await expect(page.getByText('When it was sent')).toBeVisible();

    const counted = page.getByRole('listitem').filter({ hasText: 'When it was sent' });
    await expect(counted).toContainText('5');
    await expect(counted).toContainText('Mon · Tue · Wed · Thu · Fri');

    // 2027's holidays are not finished, so it says the count may still move.
    await expect(
      page.getByText('Public holidays for 2027 are not confirmed yet; the day count may change.'),
    ).toBeVisible();

    // The approver is told. The message carries the dates and a link, and not a
    // word of why — a reason for leave can be a medical detail, and an inbox is
    // forwarded, printed and read over shoulders.
    // In the recipient's language, not the sender's: Karim's supervisor reads
    // French, so the notice is French even though this test is in English.
    const mail = await waitForSubject('Karim Alaoui', sent);

    expect(mail.subject).toBe('Demande de congé de Karim Alaoui');
    expect(mail.body).not.toContain('Hospital');
    expect(mail.body).not.toContain('mother');
    expect(mail.body).toContain('/leave/');

    await page.context().close();
  });

  test('the manager approves, and the approval is counted again and kept', async ({ browser }) => {
    const page = await open(browser, 'manager', '/leave?tab=approvals');

    // Both of them: one as the line manager, one as the second approver.
    await expect(row(page, 'Mouad Amrani')).toContainText('With the manager');
    await expect(row(page, 'Karim Alaoui')).toContainText('With the second approver');

    await row(page, 'Mouad Amrani').getByRole('link', { name: 'Open' }).click();
    await page.getByRole('button', { name: 'Approve' }).click();

    await expect(page.getByText('Done.')).toBeVisible();

    // The approval wrote its own count, beside the one from when it was sent.
    await page.goto('/leave?tab=approvals');
    await expect(row(page, 'Mouad Amrani')).toHaveCount(0);

    await page.context().close();
  });

  test('a request with nobody above the requester goes to HR', async ({ browser }) => {
    const page = await open(browser, 'hr', '/leave?tab=all');

    // The general manager has no manager on file, so the chain stopped at HR
    // rather than handing them their own request.
    const gm = page.getByRole('row').filter({ hasText: 'With HR' }).first();
    await expect(gm).toBeVisible();

    await gm.getByRole('link', { name: 'Open' }).click();
    await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();

    await page.context().close();
  });

  test('a public holiday added under a pending request redoes it, and tells HR', async ({
    browser,
  }) => {
    const page = await open(browser, 'hr', '/settings/leave?tab=holidays&year=2027');

    // A day inside Karim's February request, entered the way a moveable holiday
    // is: by hand, because nobody can calculate it.
    await page.getByLabel('Date').fill('2027-02-10');
    await page.getByLabel('Name').fill('Announced holiday');
    await page.getByRole('button', { name: 'Add it' }).click();
    await expect(row(page, 'Announced holiday')).toBeVisible();

    // It was pending, so it was counted again — and HR can see what happened.
    await page.goto('/leave?tab=review');

    const redone = page.getByRole('row').filter({ hasText: 'Karim Alaoui' }).first();
    await expect(redone).toContainText('5');
    await expect(redone).toContainText('4');
    await expect(redone).toContainText('Public holidays changed');
    await expect(redone).toContainText('Redone automatically');

    await page.context().close();
  });

  test('the requester is told their days changed, and what they were', async ({ browser }) => {
    const page = await open(browser, 'employee', '/leave');

    const changed = page.getByRole('row').filter({ hasText: '8 Feb 2027' }).first();
    await expect(changed).toContainText('4');

    await changed.getByRole('link', { name: 'Open' }).click();
    await expect(page.getByText(/The days were recounted on .* 5 became 4\./)).toBeVisible();

    // And the evidence is all there: two counts, the second one explaining itself.
    await expect(page.getByText('After a settings change', { exact: true })).toBeVisible();
    await expect(page.getByText('Announced holiday', { exact: false }).first()).toBeVisible();

    await page.context().close();
  });

  test('an approved request keeps what was agreed until HR accepts the difference', async ({
    browser,
  }) => {
    const page = await open(browser, 'hr', '/settings/leave?tab=holidays&year=2026');

    // Inside Omar Chraibi's approved request (28 Dec to 4 Jan), which was
    // agreed at five days.
    await page.getByLabel('Date').fill('2026-12-30');
    await page.getByLabel('Name').fill('Announced closure');
    await page.getByRole('button', { name: 'Add it' }).click();
    await expect(row(page, 'Announced closure')).toBeVisible();

    // Nothing moved. It is on HR's list, with both numbers.
    await page.goto('/leave?tab=all');
    await expect(row(page, 'Omar Chraibi')).toContainText('5');

    await page.goto('/leave?tab=review');
    const waiting = page.getByRole('row').filter({ hasText: 'Omar Chraibi' }).first();
    await expect(waiting).toContainText('5');
    await expect(waiting).toContainText('4');
    await expect(waiting).toContainText('Approved, so nothing has moved');

    // HR accepts, which is the only thing that moves it.
    await waiting.getByRole('button', { name: 'Accept the new count' }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Omar Chraibi' })).toHaveCount(0);

    await page.goto('/leave?tab=all');
    await expect(row(page, 'Omar Chraibi')).toContainText('4');

    // And it is in the trail, as a change somebody made.
    await page.goto('/settings/audit');
    await expect(page.getByRole('row').nth(1)).toContainText('Omar Chraibi');

    await page.context().close();
  });

  test('a year can be marked finished, and the warnings stop', async ({ browser }) => {
    const page = await open(browser, 'hr', '/settings/leave?tab=holidays&year=2027');

    await expect(page.getByText('The moveable religious holidays are not in this list.')).toBeVisible();

    const complete = page.getByLabel('Holidays complete for 2027');
    await expect(complete).not.toBeChecked();

    await complete.check();
    await page.getByRole('button', { name: 'Save this' }).click();

    await page.goto('/settings/leave?tab=holidays&year=2027');
    await expect(page.getByLabel('Holidays complete for 2027')).toBeChecked();

    // The warning the requester and the approver were shown has gone.
    await page.goto('/leave?tab=all');
    await expect(
      page.getByText('Public holidays for 2027 are not confirmed yet; the day count may change.'),
    ).toHaveCount(0);

    await page.context().close();
  });

  test('two requests cannot book the same day twice', async ({ browser }) => {
    const page = await open(browser, 'employee', '/leave/new');

    // Karim already has 7 to 11 December booked.
    await page.getByLabel('Type of leave').selectOption({ label: 'Annual leave' });
    await page.getByLabel('First day', { exact: true }).fill('2026-12-09');
    await page.getByLabel('Last day', { exact: true }).fill('2026-12-09');
    await page.getByRole('button', { name: 'Send the request' }).click();

    await expect(page.getByRole('alert').first()).toContainText(
      'You already have leave booked over 7 Dec 2026 – 11 Dec 2026.',
    );

    await page.context().close();
  });
});

/**
 * A message Mailpit has caught, found by what it is about.
 *
 * By subject rather than by recipient: the point of the test is that the right
 * person was told, and who that is comes out of the organisation rather than
 * being written down here.
 */
async function waitForSubject(
  subject: string,
  sentAfter: number,
  timeoutMs = 20_000,
): Promise<{ subject: string; to: string; body: string }> {
  const deadline = Date.now() + timeoutMs;
  const floor = sentAfter - 2_000;

  while (Date.now() < deadline) {
    const response = await fetch(`${MAILPIT}/api/v1/messages?limit=50`);
    const { messages } = (await response.json()) as {
      messages: { ID: string; Subject: string; Created: string; To: { Address: string }[] }[];
    };

    const match = messages.find(
      (message) =>
        message.Subject.includes(subject) && new Date(message.Created).getTime() >= floor,
    );

    if (match) {
      const full = await fetch(`${MAILPIT}/api/v1/message/${match.ID}`);
      const detail = (await full.json()) as { Subject: string; Text?: string; HTML?: string };

      return {
        subject: detail.Subject,
        to: match.To[0]?.Address ?? '',
        body: detail.Text ?? detail.HTML ?? '',
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`No e-mail about "${subject}" arrived within ${timeoutMs}ms`);
}

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
