import { expect, test, type Page } from '@playwright/test';
import {
  signOutFromMenu,
  startSignIn,
  submitEmail,
  submitPassword,
  TEST_PASSWORD,
  usersFor,
} from './support/sign-in';
import { skipWithoutBaseline } from './support/snapshots';

// The welcome animation (NEW / M02), built from
// docs/welcome-animation/design/welcome-animation.dc.html.
//
// It plays once, after a sign-in, over a dashboard that has already loaded. What is
// worth holding onto is when it plays, when it must not, and that it always gets out
// of the way — the rest is decoration.

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const OVERLAY = '.cp-welcome';

test.use({ timezoneId: 'Africa/Casablanca' });

test.beforeEach(({ browserName: _browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser is enough for drawing.');
});

test.describe('NEW welcome animation', () => {
  // One at a time: every test signs the same person in, and Keycloak turns away a
  // second sign-in of the same user within a second.
  test.describe.configure({ mode: 'serial' });

  test('plays after a sign-in, then hands the page over', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signIn(page);

    const overlay = page.locator(OVERLAY);
    await expect(overlay).toBeVisible();
    // Said once, to anyone listening, without making them wait for it.
    await expect(overlay).toHaveAttribute('role', 'status');
    await expect(overlay).toContainText('Signing you in to CPeople');

    // The dashboard is already underneath: the animation never gated the data.
    await expect(page.getByRole('heading', { name: 'November 2026 payroll' })).toBeAttached();

    // It ends on the original artwork, not on the layers it was built from.
    await expect(page.locator('.cp-welcome-final')).toHaveAttribute(
      'src',
      '/brand/welcome/icon-final-512.png',
    );

    await overlay.waitFor({ state: 'detached', timeout: 10_000 });
    await expect(page.locator('main#main')).toBeFocused();
  });

  test('does not play on a refresh, a return visit or a token refresh', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signIn(page);
    await page.locator(OVERLAY).waitFor({ state: 'detached', timeout: 10_000 });

    // A refresh of the same page.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator(OVERLAY)).toHaveCount(0);

    // Coming back to it from somewhere else.
    await page.goto('/');
    await page.goto('/home');
    await expect(page.locator(OVERLAY)).toHaveCount(0);

    // And the token refresh the gate sends people through, which also lands on
    // /home but is not a sign-in.
    await page.goto('/api/auth/refresh?callbackUrl=/home');
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator(OVERLAY)).toHaveCount(0);
  });

  test('a key press or a click skips it', async ({ page }) => {
    test.slow(); // two sign-ins, one for each way out.
    await page.setViewportSize(DESKTOP);
    await signIn(page);

    await expect(page.locator(OVERLAY)).toBeVisible();
    // Retried until it takes: the overlay is drawn by the server and only the
    // browser can take it away, so a key pressed before the page is hydrated is
    // a key pressed at nothing.
    await expect(async () => {
      await page.keyboard.press('Escape');
      // Gone well before the 2.7s it would otherwise take.
      await page.locator(OVERLAY).waitFor({ state: 'detached', timeout: 1_000 });
    }).toPass({ timeout: 15_000 });

    // Skipping is not the same as never having played: it is still consumed.
    await page.reload();
    await expect(page.locator(OVERLAY)).toHaveCount(0);

    await signOut(page);
    await signIn(page);

    const overlay = page.locator(OVERLAY);
    await expect(overlay).toBeVisible();
    await expect(async () => {
      await overlay.click({ position: { x: 40, y: 40 } });
      await overlay.waitFor({ state: 'detached', timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect(page.locator('main#main')).toBeFocused();
  });

  test('reduced motion shows the finished logo, briefly', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(DESKTOP);

    const started = Date.now();
    await signIn(page);

    const overlay = page.locator(OVERLAY);
    if (await overlay.count()) {
      // Nothing draws: the C is whole from the first frame, and the class that
      // carries every transition is not there.
      await expect(overlay).not.toHaveClass(/cp-welcome--motion/);
      await expect(page.locator('.cp-welcome-final')).toHaveCSS('opacity', '1');
    }

    await overlay.waitFor({ state: 'detached', timeout: 5_000 });
    // It is a held frame, not a performance: far shorter than the full sequence.
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  test('matches the approved frames, on a desktop and on a phone', async ({ page }, testInfo) => {
    skipWithoutBaseline(testInfo, 'welcome-c-1440x900.png');
    // Two sign-ins, and a sequence that is over in 2.7 seconds.
    test.slow();

    for (const size of [DESKTOP, PHONE]) {
      await page.setViewportSize(size);
      await signIn(page);

      // Caught while it runs, then compared afterwards: comparing a picture takes
      // longer than the moment it is a picture of.
      const half = await frameAt(page, 'the C half drawn', () => {
        const drawn = document.querySelector('.cp-welcome-c');
        if (!drawn) return false;
        const sweep = Number.parseFloat(getComputedStyle(drawn).getPropertyValue('--sweep'));
        return sweep > 60 && sweep < 170;
      });

      const people = await frameAt(page, 'the three people in', () => {
        const popped = [...document.querySelectorAll('.cp-welcome-person')];
        return popped.length === 3 && popped.every((p) => Number(getComputedStyle(p).opacity) > 0.9);
      });

      const word = await frameAt(page, 'the wordmark in', () => {
        const mark = document.querySelector('.cp-welcome-word');
        if (!mark) return false;
        const style = getComputedStyle(mark);
        return Number(style.opacity) > 0.95 && !style.clipPath.includes('100%');
      });

      const at = `${size.width}x${size.height}`;
      expect(half).toMatchSnapshot(`welcome-c-${at}.png`, { maxDiffPixelRatio: 0.05 });
      expect(people).toMatchSnapshot(`welcome-people-${at}.png`, { maxDiffPixelRatio: 0.05 });
      expect(word).toMatchSnapshot(`welcome-word-${at}.png`, { maxDiffPixelRatio: 0.05 });

      await page.locator(OVERLAY).waitFor({ state: 'detached', timeout: 10_000 });
      await signOut(page);
    }
  });

  /** Waits for a moment in the animation and photographs it there. */
  async function frameAt(
    page: Page,
    moment: string,
    reached: () => boolean,
  ): Promise<Buffer> {
    await page
      .waitForFunction(reached, null, { timeout: 8_000, polling: 'raf' })
      .catch(() => {
        throw new Error(`The animation never showed ${moment}.`);
      });

    return page.screenshot();
  }
});

/** Signs in and lands on the home screen, with the clock pinned for the screens. */
async function signIn(page: Page): Promise<void> {
  await page.context().addCookies([
    { name: 'cpeople_now', value: '2026-11-18T09:40:00+01:00', url: 'http://localhost:3000' },
  ]);
  await startSignIn(page);
  await submitEmail(page, usersFor('desktop-chromium').employee.email);
  await submitPassword(page, TEST_PASSWORD);
  await expect(page).toHaveURL(/\/home$/);
}

/**
 * Ends the session, here and at Keycloak, so the next sign-in is a real one and
 * the animation has a reason to play again.
 */
async function signOut(page: Page): Promise<void> {
  await signOutFromMenu(page, usersFor('desktop-chromium').employee.name);
  // Keycloak ends its own session on the way, which is a round trip.
  await expect(page).toHaveURL(/\/signed-out$/, { timeout: 15_000 });
}
