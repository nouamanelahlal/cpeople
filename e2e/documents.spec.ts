import { expect, test, type Browser, type Page } from '@playwright/test';
import { openAs, useEnglish, type DemoRole } from './support/demo-users';

/**
 * Documents and expiry (HR-01 spec 6.7).
 *
 * The acceptance criterion the spec sets is a chain, and it is the chain that
 * matters: upload a certificate that runs out in ten days, and the figure on the
 * home screen goes up by one, the list it opens holds the person, and their row
 * shows that something is running out. One rule decides all four, so this test
 * follows it from end to end.
 */

test.beforeEach(({ browserName: _browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser is enough.');
  testInfo.setTimeout(150_000);
});

/** A small, real PDF: enough bytes for a reader to open and recognise. */
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF\n',
  'utf8',
);

/** What the company looked like before this file touched it. */
let expiringBefore = 0;

test.describe('HR-01 documents and expiry', () => {
  test.describe.configure({ mode: 'serial' });

  test('a document that runs out soon reaches the home screen and the list', async ({
    browser,
  }) => {
    const page = await open(browser, 'hr', '/home');

    // What the company looks like before: five documents running out.
    const card = page.getByRole('region', { name: 'Today at a glance' }).getByRole('link').nth(3);
    // The figure itself, not every digit on the card: its note has numbers in it
    // too, and "5" followed by "30 days" is not five hundred and thirty.
    const before = Number.parseInt(/(\d+)/.exec((await card.textContent()) ?? '')?.[1] ?? '0', 10);
    expect(before).toBeGreaterThan(0);
    expiringBefore = before;

    // Leila Fassi is in the outlet, and nothing of hers is running out yet.
    await page.goto('/employees?q=leila%20fassi');
    await page.getByRole('link', { name: 'Open Leila Fassi' }).click();
    await page
      .getByRole('navigation', { name: 'File sections' })
      .getByRole('link', { name: 'Documents' })
      .click();
    await page.waitForURL(/tab=documents/);

    await page.getByRole('link', { name: 'Add a document' }).click();
    await page.getByLabel('Kind of document').selectOption({ label: 'Medical aptitude certificate' });
    await page.getByLabel('File', { exact: true }).setInputFiles({
      name: 'medical-certificate.pdf',
      mimeType: 'application/pdf',
      buffer: PDF,
    });
    // Ten days after the demo clock, which is what the spec asks for.
    await page.getByLabel('Expires on').fill('2026-12-03');
    await page.getByRole('button', { name: 'Add it to the file' }).click();

    await expect(page.getByText('Added to the file.', { exact: false })).toBeVisible();

    // On the file: the kind, the date, and how long it has left in words.
    const row = page.getByRole('row').filter({ hasText: 'medical-certificate.pdf' }).first();
    await expect(row).toContainText('3 Dec 2026');
    await expect(row).toContainText('Expires in 10 days');

    // The bytes come back through the application, not from the API directly.
    const opened = await page.request.get(
      (await row.getByRole('link').first().getAttribute('href')) ?? '',
    );
    expect(opened.status()).toBe(200);
    expect(opened.headers()['content-type']).toContain('pdf');

    // And the figure on the home screen has followed it.
    await page.goto('/home');
    await expect(card).toContainText(String(before + 1));

    // The card opens the list, and she is in it.
    await card.click();
    await expect(page).toHaveURL(/filter=documents-expiring/);
    await expect(page.getByRole('row').filter({ hasText: 'Leila Fassi' })).toHaveCount(1);
    await expect(
      page.getByRole('row').filter({ hasText: 'Leila Fassi' }).getByText('Expiring'),
    ).toBeVisible();

    await page.context().close();
  });

  test('refuses what it should, and says why', async ({ browser }) => {
    const page = await open(browser, 'hr', '/employees?q=leila%20fassi');

    await page.getByRole('link', { name: 'Open Leila Fassi' }).click();
    await page.goto(`${page.url()}?tab=documents&edit=1`);

    // A kind of document that must carry an expiry date says so on the form.
    await page.getByLabel('Kind of document').selectOption({ label: 'Residence permit' });
    await expect(page.getByText('This kind of document needs an expiry date.')).toBeVisible();

    // Something that is not a PDF or an image is refused by the API, whatever
    // the form let through.
    await page.getByLabel('File', { exact: true }).setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a document', 'utf8'),
    });
    await page.getByLabel('Expires on').fill('2027-06-30');
    await page.getByRole('button', { name: 'Add it to the file' }).click();

    await expect(
      page.getByText('A document must be a PDF, a JPEG or a PNG.', { exact: false }),
    ).toBeVisible();

    await page.context().close();
  });

  test('a manager sees what is on a file without being able to open it', async ({ browser }) => {
    const hr = await open(browser, 'hr', '/employees?q=karim%20alaoui');
    const file = await hr.getByRole('link', { name: 'Open Karim Alaoui' }).getAttribute('href');
    await hr.context().close();

    const manager = await open(browser, 'manager', `${file}?tab=documents`);

    // The rows are there — knowing a certificate is on file is their business.
    await expect(manager.getByRole('row').nth(1)).toBeVisible();
    // Opening one is not: nothing on the row is a link, and nothing offers to
    // take it off the file.
    await expect(manager.getByRole('table').getByRole('link')).toHaveCount(0);
    await expect(manager.getByRole('button', { name: 'Remove' })).toHaveCount(0);
    await expect(manager.getByRole('link', { name: 'Add a document' })).toHaveCount(0);

    await manager.context().close();
  });

  test('HR takes the certificate off again, and the figure goes back', async ({ browser }) => {
    const page = await open(browser, 'hr', '/employees?q=leila%20fassi');

    await page.getByRole('link', { name: 'Open Leila Fassi' }).click();
    await page.goto(`${page.url()}?tab=documents`);

    // Whatever this file added, and only that: she may have had papers of the
    // same kind before it started.
    const added = page.getByRole('row').filter({ hasText: 'medical-certificate.pdf' });

    while ((await added.count()) > 0) {
      await added.first().getByRole('button', { name: 'Remove' }).click();
      await expect(page.getByText('Removed from the file.')).toBeVisible();
    }

    // Back where it started: the demo opens from the same place every time.
    await page.goto('/home');
    await expect(
      page.getByRole('region', { name: 'Today at a glance' }).getByRole('link').nth(3),
    ).toContainText(String(expiringBefore));

    await page.context().close();
  });
});

/** Signed in, reading English, whatever their account prefers. */
async function open(browser: Browser, role: DemoRole, path: string): Promise<Page> {
  const page = await openAs(browser, role, { path });
  await useEnglish(page);
  return page;
}
