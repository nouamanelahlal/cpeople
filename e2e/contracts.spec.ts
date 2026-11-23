import { expect, test, type Browser, type Page } from '@playwright/test';
import { openAs, useEnglish, type DemoRole } from './support/demo-users';

/**
 * Contracts: generated, signed, renewed, ended (HR-01 spec 6.6).
 *
 * The acceptance criterion is the demo's 14:30 slot, and it is a chain: from the
 * home screen, "Omar Chraibi — fixed-term contract ends" opens his contract,
 * renewing it leaves a new draft, and the item leaves "Waiting for you". The
 * document itself is checked for what matters about it — that it is a real PDF,
 * named the way the spec asks, with the merge data filled in.
 */

test.beforeEach(({ browserName: _browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser is enough.');
  testInfo.setTimeout(180_000);
});

const SCAN = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
  'utf8',
);

test.describe('HR-01 contracts', () => {
  test.describe.configure({ mode: 'serial' });

  test('lists what is running and what is about to end', async ({ browser }) => {
    const page = await open(browser, 'hr', '/contracts');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Contracts');

    // The fixed terms about to run out: Omar Chraibi's is the soonest in the
    // company, on 30 November.
    await page.getByRole('link', { name: 'Ending in 30 days' }).click();
    const omar = page.getByRole('row').filter({ hasText: 'Omar Chraibi' });
    await expect(omar).toHaveCount(1);
    await expect(omar).toContainText('30 Nov 2026');
    await expect(omar).toContainText('CDD');

    await page.context().close();
  });

  test('generates the document, with the merge data filled in', async ({ browser }) => {
    const page = await open(browser, 'hr', '/contracts?view=ending');

    await page.getByRole('row').filter({ hasText: 'Omar Chraibi' }).getByRole('link').first().click();
    await expect(page).toHaveURL(/\/contracts\/[0-9a-f-]{36}$/);

    // What the document will say, before anything is printed.
    await expect(page.getByText('CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE')).toBeVisible();
    await expect(page.getByText('employee.fullName')).toBeVisible();
    await expect(page.getByText('Omar Chraibi', { exact: false }).first()).toBeVisible();
    // The salary is written twice, as a contract writes it.
    await expect(page.getByText(/dirhams/)).toBeVisible();

    // Mandatory clauses are stated, optional ones are a choice.
    await expect(page.getByText('Always included').first()).toBeVisible();
    await expect(page.getByLabel(/Non-concurrence/)).toBeVisible();

    // Omar's contract was generated once already by the seed, so the button
    // offers to do it again; either wording is the same act.
    await page.getByRole('button', { name: /^Generate/ }).click();
    await expect(page.getByText('Generated.', { exact: false })).toBeVisible({ timeout: 60_000 });

    // It is a real PDF, filed on the employee, named as the spec asks.
    const file = await page.getByText(/Contrat_CDD_SMG-\d+_\d{8}\.pdf/).first().textContent();
    expect(file).toMatch(/Contrat_CDD_SMG-\d+_\d{8}\.pdf/);

    const employee = await page.getByRole('link', { name: 'Omar Chraibi' }).getAttribute('href');
    await page.goto(`${employee}?tab=documents`);
    const row = page.getByRole('row').filter({ hasText: 'Contrat_CDD' }).first();
    await expect(row).toBeVisible();

    const pdf = await page.request.get((await row.getByRole('link').first().getAttribute('href')) ?? '');
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toContain('pdf');
    // A PDF starts with %PDF, whatever else it contains.
    expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');

    await page.context().close();
  });

  test('renewing a fixed term clears it from what is waiting', async ({ browser }) => {
    const page = await open(browser, 'hr', '/home');

    // The home screen says it first: the demo's 14:30 slot starts here.
    const waiting = page.getByRole('region', { name: 'Waiting for you' });
    await expect(waiting.getByText('Omar Chraibi', { exact: false }).first()).toBeVisible();

    await page.goto('/contracts?view=ending');
    await page.getByRole('row').filter({ hasText: 'Omar Chraibi' }).getByRole('link').first().click();

    // Renewing says what nobody here can answer: how often a fixed term may be
    // renewed is SMG's question.
    await expect(page.getByText('Check renewal limits', { exact: false })).toBeVisible();

    await page.getByLabel('The new term ends on').fill('2027-05-31');
    await page.getByRole('button', { name: 'Renew', exact: true }).click();

    await expect(page.getByText('Renewed.', { exact: false })).toBeVisible();
    // It lands on the new draft, which starts the day after the old one ended.
    await expect(page.getByText('1 Dec 2026', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Draft').first()).toBeVisible();

    // And the home screen has stopped asking.
    await page.goto('/home');
    await expect(
      page.getByRole('region', { name: 'Waiting for you' }).getByText('fixed-term contract ends', {
        exact: false,
      }),
    ).toHaveCount(0);

    await page.context().close();
  });

  test('marking a contract signed ticks the onboarding item that waited for it', async ({
    browser,
  }) => {
    // Somebody who has not started yet: the seed gives the people joining on
    // 1 December a draft contract and a checklist with an item waiting on it.
    const page = await open(browser, 'hr', '/employees?status=onboarding');

    const joining = page.getByRole('row').nth(1);
    await expect(joining).toBeVisible();
    const name = (await joining.getByRole('link').first().textContent())?.trim() ?? '';
    await joining.getByRole('link').first().click();

    const file = page.url().split('?')[0]!;
    await page.goto(`${file}?tab=contracts`);
    await page.getByRole('link', { name: /Contrat/ }).first().click();
    await expect(page).toHaveURL(/\/contracts\/[0-9a-f-]{36}/);

    await page.getByLabel('The signed scan').setInputFiles({
      name: 'contrat-signe.pdf',
      mimeType: 'application/pdf',
      buffer: SCAN,
    });
    await page.getByRole('button', { name: 'Mark it signed' }).click();

    await expect(page.getByText('Signed.', { exact: false })).toBeVisible({ timeout: 60_000 });
    expect(name).not.toBe('');

    // The item that was waiting for exactly this has ticked itself.
    await page.goto(`${file}?tab=onboarding`);
    const task = page
      .getByRole('listitem')
      .filter({ hasText: 'Generate and sign the contract' })
      .first();
    await expect(task).toContainText('Done by Salma Benali');

    await page.context().close();
  });

  test('a manager may read a contract and not change it', async ({ browser }) => {
    const hr = await open(browser, 'hr', '/contracts');
    const link = await hr
      .getByRole('row')
      .filter({ hasText: 'Karim Alaoui' })
      .first()
      .getByRole('link')
      .first()
      .getAttribute('href');
    await hr.context().close();

    const manager = await open(browser, 'manager', String(link));

    await expect(manager.getByRole('heading', { level: 1 })).toContainText('Karim Alaoui');
    await expect(manager.getByRole('button', { name: /^Generate/ })).toHaveCount(0);
    await expect(manager.getByRole('button', { name: 'End the contract' })).toHaveCount(0);

    await manager.context().close();
  });
});

/** Signed in, reading English, whatever their account prefers. */
async function open(browser: Browser, role: DemoRole, path: string): Promise<Page> {
  const page = await openAs(browser, role, { path });
  await useEnglish(page);
  return page;
}
