import { expect, test, type Page } from '@playwright/test';
import {
  dismissWelcome,
  startSignIn,
  submitCode,
  submitEmail,
  submitPassword,
  TEST_PASSWORD,
  usersFor,
} from './support/sign-in';
import { resetDemoData } from './support/demo-data';
import { skipWithoutBaseline } from './support/snapshots';

// The home screen (NEW / M23), built from docs/design/home-dashboard.dc.html.
//
// It runs in one browser project because what is being checked is how the page is
// drawn and worded, at sizes this file sets itself. The sign-in flow that gets here
// is m02-sign-in.spec.ts's business.

const LAPTOP = { width: 1280, height: 720 };
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

/**
 * The morning of the workshop, which is the day the demo data is written around:
 * the contracts that end "this week" and the documents expiring "in 30 days" are
 * all measured from it, and the API is pinned to the same day in a developer's
 * checkout.
 *
 * The greeting depends on the clock and the screen would otherwise look different
 * three times a day, so the local-dev clock cookie pins it (see lib/clock.ts). The
 * timezone is pinned with it, because "good morning" is about where the reader is.
 */
const MORNING = '2026-11-23T09:40:00+01:00';
const AFTERNOON = '2026-11-23T14:10:00+01:00';
const EVENING = '2026-11-23T19:40:00+01:00';

/**
 * Signed in once, for the whole file.
 *
 * The home screen counts over the files the reader may see, so these tests need
 * someone who sees the company: the payroll manager, whose role also takes the
 * authenticator step. Doing that seven times would not work even if it were not
 * slow — a six-digit code lasts thirty seconds and cannot be used twice — so the
 * session is made once and reused, and the sign-in itself is m02's subject.
 */
const SESSION = '.auth/home-payroll.json';

test.use({ timezoneId: 'Africa/Casablanca', storageState: SESSION });

test.beforeEach(({ browserName: _browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser is enough for drawing.');
});

test.beforeAll(async ({ browser }, testInfo) => {
  if (testInfo.project.name !== 'desktop-chromium') return;

  const user = usersFor('desktop-chromium').payroll;
  // Signed out, explicitly: the file's own storageState does not exist yet, and
  // every context from this fixture would otherwise try to load it.
  const context = await browser.newContext({
    timezoneId: 'Africa/Casablanca',
    storageState: undefined,
  });
  const page = await context.newPage();

  await startSignIn(page);
  await submitEmail(page, user.email);
  await submitPassword(page, TEST_PASSWORD);
  await submitCode(page, user.otpSecret);
  await expect(page).toHaveURL(/\/home$/, { timeout: 20_000 });

  await context.storageState({ path: SESSION });
  await context.close();
});

/**
 * The seeded company, as this file expects to find it: the tests before this
 * one hire people and sign contracts, and the figures here are asserted.
 */
test.beforeAll(({ browserName: _browserName }, testInfo) => {
  if (testInfo.project.name !== 'desktop-chromium') return;
  resetDemoData();
});

test.describe('NEW home dashboard', () => {
  // One at a time: every test here signs the same person in, and Keycloak's guard
  // against repeated sign-ins within a second would turn the second one away.
  test.describe.configure({ mode: 'serial' });

  test('shows the signed-in person, the payroll month and the day around it', async ({ page }) => {
    await signIn(page, MORNING);

    const user = usersFor('desktop-chromium').payroll;
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      `Good morning, ${user.name.split(' ')[0]}`,
    );
    await expect(
      page.getByText('Monday, 23 November 2026. November payroll is in review.'),
    ).toBeVisible();

    // Their own name and role, from the token rather than from the sample data.
    await expect(page.getByRole('button', { name: `Account: ${user.name}` })).toContainText(
      'Payroll manager',
    );

    // The figures are counted in the database, over the files this person may
    // see: a payroll manager sees the company.
    const glance = page.getByRole('region', { name: 'Today at a glance' });
    await expect(glance.getByRole('link')).toHaveCount(4);
    await expect(glance.getByRole('link').first()).toContainText('148');
    await expect(glance.getByRole('link').nth(3)).toContainText('5');

    // And what is waiting is real: each row opens the file it belongs to.
    const rows = page.getByRole('region', { name: 'Waiting for you' }).getByRole('listitem');
    await expect(rows.first()).toBeVisible();
    await expect(rows.first().getByRole('link')).toHaveAttribute('href', /\/employees\/[0-9a-f-]+$/);

    // The payroll month, with money written the way English writes it.
    await expect(page.getByRole('heading', { name: 'November 2026 payroll' })).toBeVisible();
    await expect(page.getByText('MAD', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('1,284,650.00')).toBeVisible();
    await expect(page.getByText('Pay date in 7 days, on 30 November')).toBeVisible();

    // Every panel the design asks for.
    await expect(page.getByRole('heading', { name: 'Waiting for you' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Away this week' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Payroll cost, last 12 months' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Headcount by department' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Declarations and connections' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Today at a glance' }).getByRole('link')).toHaveCount(4);
  });

  test('greets by the time of day, in English and in French', async ({ page }) => {
    await signIn(page, MORNING);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Good morning,');

    for (const [when, expected] of [
      [AFTERNOON, 'Good afternoon,'],
      [EVENING, 'Good evening,'],
    ] as const) {
      await pinClock(page, when);
      await page.reload();
      await expect(page.getByRole('heading', { level: 1 })).toContainText(expected);
    }

    // French has two greetings for the three parts of the day, and keeps
    // "Bienvenue" for the sign-in page.
    await switchToFrench(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Bonsoir,');
    await expect(page.getByRole('heading', { level: 1 })).not.toContainText('Bienvenue');

    await pinClock(page, MORNING);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Bonjour,');
    await pinClock(page, AFTERNOON);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Bonjour,');
  });

  test('writes money and dates the way each language does', async ({ page }) => {
    await signIn(page, MORNING);

    // English: the currency leads, groups with commas.
    await expect(page.getByText('1,284,650.00')).toBeVisible();
    await expect(page.getByText('16 to 20 Nov').first()).toBeVisible();

    await switchToFrench(page);

    // French: the currency follows, groups with spaces, decimal comma — and the
    // month elides after "de".
    await expect(page.getByRole('heading', { name: 'Paie de novembre 2026' })).toBeVisible();
    await expect(page.getByText(/1\s?284\s?650,00/)).toBeVisible();
    await expect(page.getByText('lundi 23 novembre 2026.', { exact: false })).toBeVisible();
    await expect(page.getByText("Paie d'octobre", { exact: false })).toBeVisible();
    await expect(page.getByText('du 16 au 20 nov.').first()).toBeVisible();
  });

  test('opens the menu on hover, on focus and when it is pinned', async ({ page }) => {
    await signIn(page, MORNING);

    const nav = page.getByRole('navigation', { name: 'Main' });
    const employees = nav.getByRole('link', { name: 'Employees' });

    // Collapsed: the icons are there, their names are not.
    await expect(nav).toHaveCSS('width', '76px');
    await expect(employees).not.toContainText('Employees');

    // Retried until it takes: the development server hydrates the page a moment
    // after it is drawn, and until it has, a hover is just a hover.
    await expect(async () => {
      await nav.hover();
      await expect(nav).toHaveCSS('width', '260px', { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect(employees).toContainText('Employees');

    // Hovering floats the menu over the page rather than moving it: the content
    // beside it must not shift under the pointer.
    const headingBefore = await page.getByRole('heading', { level: 1 }).boundingBox();
    await page.mouse.move(700, 400);
    await expect(nav).toHaveCSS('width', '76px');
    await nav.hover();
    expect((await page.getByRole('heading', { level: 1 }).boundingBox())?.x).toBe(headingBefore?.x);

    // Pinned, it keeps its place and the page makes room for it.
    await page.getByRole('button', { name: 'Keep the menu open' }).click();
    await page.mouse.move(700, 400);
    await expect(nav).toHaveCSS('width', '260px');
    expect((await page.getByRole('heading', { level: 1 }).boundingBox())?.x).toBeGreaterThan(
      headingBefore?.x ?? 0,
    );

    // And it is still pinned on the next page load.
    await page.reload();
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCSS('width', '260px');
    await page.getByRole('button', { name: 'Let the menu collapse' }).click();

    // Keyboard only: tabbing into the menu opens it too.
    await page.reload();
    await expect(async () => {
      await page.keyboard.press('Tab');
      await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCSS('width', '260px', {
        timeout: 1_000,
      });
    }).toPass({ timeout: 15_000 });
  });

  test('is a drawer on a phone, and names every other month on the chart', async ({ page }) => {
    await signIn(page, MORNING);
    await page.setViewportSize(PHONE);

    // No rail: the menu is behind a button, and the page has the whole width.
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav).toBeHidden();

    await expect(async () => {
      await page.getByRole('button', { name: 'Open menu' }).click();
      await expect(nav).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect(nav.getByRole('link', { name: 'Employees' })).toBeVisible();
    await nav.getByRole('button', { name: 'Close menu' }).click();
    await expect(nav).toBeHidden();

    // Twelve month names in a phone's width is a smudge, so every second one is
    // hidden — without moving the ones that stay.
    const labels = page.locator('.grid-cols-12 > span');
    await expect(labels).toHaveCount(12);
    await expect(labels.nth(0)).toBeHidden();
    await expect(labels.nth(1)).toBeVisible();
    await expect(labels.nth(11)).toBeVisible();

    const second = await labels.nth(1).boundingBox();
    const last = await labels.nth(11).boundingBox();
    expect(second?.x).toBeLessThan(last?.x ?? 0);
  });

  test('holds still when reduced motion is asked for', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await signIn(page, MORNING);

    // The two places that move on this screen when motion is welcome: the menu as
    // it opens, and the watermark drifting under the pointer. Both carry an
    // explicit motion-reduce rule, and both must be inert here.
    const moving = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Main"]')!;
      const mark = document.querySelector('.cp-symbol-mark')!;
      return {
        nav: getComputedStyle(nav).transitionProperty,
        mark: getComputedStyle(mark).transitionProperty,
      };
    });

    expect(moving.nav).toBe('none');
    expect(moving.mark).toBe('none');
  });

  test('matches the approved home screen, in English and in French', async ({ page }, testInfo) => {
    skipWithoutBaseline(testInfo, 'home-en-1440x900.png');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await signIn(page, MORNING);

    for (const [language, name] of [
      ['en', 'English'],
      ['fr', 'French'],
    ] as const) {
      if (language === 'fr') await switchToFrench(page);

      for (const size of [DESKTOP, LAPTOP, PHONE]) {
        await page.setViewportSize(size);
        await settle(page);
        await expect(page).toHaveScreenshot(
          `home-${language}-${size.width}x${size.height}.png`,
          { fullPage: true, maxDiffPixelRatio: 0.02, timeout: 20_000 },
        );
      }

      expect(name).toBeTruthy();
    }
  });
});

/** Signs in and lands on the home screen, with the clock pinned. */
/** Opens the home screen on an already-signed-in page, at a given moment. */
async function signIn(page: Page, when: string): Promise<void> {
  await pinClock(page, when);
  await page.goto('/home');
  await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
  // Nothing should be playing — the animation follows a sign-in, and this page
  // did not come from one — but if it ever does, it is in the way here.
  await dismissWelcome(page);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

/**
 * Pins the clock the page renders from.
 *
 * Only a developer's checkout honours this cookie — a deployed environment ignores
 * it — which is what lets the screenshots be taken at the same moment every time.
 */
async function pinClock(page: Page, when: string): Promise<void> {
  await page.context().addCookies([
    { name: 'cpeople_now', value: when, url: 'http://localhost:3000' },
  ]);
}

async function switchToFrench(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Language: Français' }).click();
  await expect(page.getByRole('button', { name: 'Langue : English' })).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

/** Waits for the type and the layout to settle before a picture is taken. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForTimeout(250);
}
