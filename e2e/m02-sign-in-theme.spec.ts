import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
  clearLockout,
  startSignIn,
  submitEmail,
  submitPassword,
  usersFor,
} from './support/sign-in';

// The CPeople sign-in theme (packages/keycloak-theme): the things manual testing
// caught, kept caught. These run in one browser project because they are about how
// the pages are built and drawn, not about the flow, which m02-sign-in.spec.ts
// exercises on every project.

const DESKTOP = { width: 1440, height: 900 };
/** The window the theme was manually tested in, which is where the tiles slipped. */
const LAPTOP = { width: 1566, height: 707 };

test.beforeEach(({ browserName: _browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser is enough for drawing.');
});

test.describe('M02 sign-in theme', () => {
  test('uses Montserrat, served by Keycloak and not by Google', async ({ page }) => {
    const toGoogle: string[] = [];
    page.on('request', (request) => {
      if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) toGoogle.push(request.url());
    });

    await page.setViewportSize(DESKTOP);
    await startSignIn(page);

    const font = await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        available: document.fonts.check('400 16px Montserrat'),
        heading: getComputedStyle(document.querySelector('h1')!).fontFamily,
      };
    });

    // A sign-in page calling out to Google would leak every visitor to a third
    // party and leave the brand typeface at the mercy of a network they may not
    // reach, so the files are the theme's own.
    expect(toGoogle).toEqual([]);
    expect(font.available).toBe(true);
    expect(font.heading).toMatch(/Montserrat/);
  });

  test('shows one message, not the same one twice', async ({ page }) => {
    // The user whose password exists to be got wrong, so no other test inherits a
    // failed-attempt count from this one.
    const { email } = usersFor('desktop-chromium').wrongPassword;
    await clearLockout(email);

    await page.setViewportSize(DESKTOP);
    await startSignIn(page);

    await submitEmail(page, email);
    await submitPassword(page, 'not-the-right-password');

    // Keycloak reports the same problem twice, as a page message and against the
    // field. Exactly one of them reaches the screen.
    await expect(page.locator('.cp-alert')).toHaveCount(1);
    await expect(page.locator('.cp-alert')).toContainText(/match|correspond/i);

    await clearLockout(email);
  });

  test('keeps the glass tiles clear of the cards and the headline, at any size', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await startSignIn(page);

    const widths = [1000, 1100, 1366, 1440, 1566, 1920, 2560];
    const heights = [650, 707, 800, 900, 1080, 1440];
    const problems: string[] = [];

    for (const width of widths) {
      for (const height of heights) {
        await page.setViewportSize({ width, height });
        // Give the layout a frame to settle before measuring.
        await page.evaluate(() => new Promise(requestAnimationFrame));

        const result = await page.evaluate(() => {
          const rect = (selector: string) => {
            const element = document.querySelector(selector);
            return element ? element.getBoundingClientRect() : null;
          };

          const clip = rect('.cp-showcase-top');
          const area = rect('.cp-tiles-area');
          const tiles = rect('.cp-tiles');
          const cards = rect('.cp-activity');
          const headline = rect('.cp-showcase-copy h2');
          if (!clip || !area || !tiles || !cards || !headline) return null;

          // The tiles are rotated and clipped, so their layout box says more than
          // the eye sees. What matters is the part still on screen.
          const visible = {
            top: Math.max(tiles.top, clip.top, area.top),
            bottom: Math.min(tiles.bottom, clip.bottom, area.bottom),
            left: Math.max(tiles.left, clip.left, area.left),
            right: Math.min(tiles.right, clip.right, area.right),
          };
          const hits = (other: DOMRect) =>
            visible.left < other.right &&
            visible.right > other.left &&
            visible.top < other.bottom &&
            visible.bottom > other.top;

          return {
            overCards: hits(cards),
            overHeadline: hits(headline),
            overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          };
        });

        if (result === null) continue; // the panel is hidden at this width
        if (result.overCards || result.overHeadline || result.overflowX > 0) {
          problems.push(
            `${width}x${height}: cards=${result.overCards} headline=${result.overHeadline} overflowX=${result.overflowX}`,
          );
        }
      }
    }

    expect(problems).toEqual([]);
  });

  test('matches the approved sign-in page', async ({ page }, testInfo) => {
    skipWithoutBaseline(testInfo, 'sign-in-1440x900.png');

    await hold(page);
    await page.setViewportSize(DESKTOP);
    await startSignIn(page);
    await settle(page);
    await expect(page).toHaveScreenshot('sign-in-1440x900.png', { maxDiffPixelRatio: 0.02, timeout: 20_000 });

    await page.setViewportSize(LAPTOP);
    await settle(page);
    await expect(page).toHaveScreenshot('sign-in-1566x707.png', { maxDiffPixelRatio: 0.02, timeout: 20_000 });
  });

  test('matches the approved password step', async ({ page }, testInfo) => {
    skipWithoutBaseline(testInfo, 'password-1440x900.png');

    const users = usersFor('desktop-chromium');

    await hold(page);
    await page.setViewportSize(DESKTOP);
    await startSignIn(page);
    await submitEmail(page, users.employee.email);
    await settle(page);
    await expect(page).toHaveScreenshot('password-1440x900.png', { maxDiffPixelRatio: 0.02, timeout: 20_000 });

    await page.setViewportSize(LAPTOP);
    await settle(page);
    await expect(page).toHaveScreenshot('password-1566x707.png', { maxDiffPixelRatio: 0.02, timeout: 20_000 });
  });
});

/**
 * Pixel baselines belong to the platform that made them — Windows and Linux do not
 * draw text identically — so a machine without one says so rather than failing or,
 * worse, passing quietly. To add the missing platform's baselines, run this file
 * with `--update-snapshots` on that platform.
 *
 * What holds on every platform is checked by the other tests here: the font, the
 * single message, and the panel geometry at 42 window sizes.
 */
function skipWithoutBaseline(testInfo: TestInfo, snapshot: string): void {
  const expected = testInfo.snapshotPath(snapshot);
  test.skip(
    !existsSync(expected),
    `No baseline for ${process.platform} at ${path.basename(expected)}. ` +
      'Run `pnpm exec playwright test e2e/m02-sign-in-theme.spec.ts --update-snapshots` here.',
  );
}

/**
 * Holds the page still for a screenshot.
 *
 * Asking for reduced motion is what the panel already listens to: the icon stops
 * drifting, the dot stops pulsing, and the activity cards stop cycling. So this
 * steadies the picture and exercises the reduced-motion path at the same time.
 */
async function hold(page: Page): Promise<void> {
  // Asked for before anything loads, so the panel never starts moving: the icon
  // stays put, the dot stops pulsing and the activity cards stop cycling. It also
  // means the reduced-motion path is the one being photographed.
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

/** Waits for the type to arrive, so the picture is of the real font. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForTimeout(200);
}
