import { expect, test, type Page } from '@playwright/test';
import {
  clearLockout,
  startSignIn,
  submitEmail,
  submitPassword,
  usersFor,
} from './support/sign-in';
import { skipWithoutBaseline } from './support/snapshots';

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

  test('fades the glass tiles out instead of cutting them', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await startSignIn(page);

    // A clip leaves half a tile with a straight edge down the middle of it, which is
    // what manual testing saw. The mask has to reach fully transparent at every edge
    // of its box, and the box must not be clipping anything itself — then there is
    // nothing left at any edge to show a straight line.
    const mask = await page.locator('.cp-tiles-area').evaluate((area) => {
      const style = getComputedStyle(area);
      return {
        overflow: style.overflow,
        repeat: style.maskRepeat,
        image: style.maskImage,
      };
    });

    expect(mask.overflow).toBe('visible');
    // Without no-repeat the mask would tile across the spill instead of ending it.
    expect(mask.repeat).toMatch(/^no-repeat(, no-repeat)?$/);

    // One gradient across, one down, and each starting and ending at nothing: four
    // edges, four fades.
    const count = (pattern: RegExp) => (mask.image.match(pattern) ?? []).length;
    expect(count(/linear-gradient\(/g)).toBe(2);
    expect(count(/rgba\(0, 0, 0, 0\) 0(px)?,/g)).toBe(2);
    expect(count(/rgba\(0, 0, 0, 0\) 100%\)/g)).toBe(2);
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

          const area = document.querySelector('.cp-tiles-area');
          const cards = rect('.cp-activity');
          const headline = rect('.cp-showcase-copy h2');
          if (area === null || cards === null || headline === null) return null;

          // What people see is this box less its fades: at the fade stops the
          // drawing is already on its way out, and past them there is nothing. The
          // stops are declared in the stylesheet, so this reads them rather than
          // repeating them.
          const box = area.getBoundingClientRect();
          const style = getComputedStyle(area);
          const share = (name: string) => Number.parseFloat(style.getPropertyValue(name)) / 100;
          const solid = {
            left: box.left + box.width * share('--cp-fade-inline-start'),
            right: box.right - box.width * share('--cp-fade-inline-end'),
            top: box.top + box.height * share('--cp-fade-block-start'),
            bottom: box.bottom - box.height * share('--cp-fade-block-end'),
          };
          const hits = (other: DOMRect) =>
            solid.left < other.right &&
            solid.right > other.left &&
            solid.top < other.bottom &&
            solid.bottom > other.top;

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

  test('keeps the floating icon inside the panel, clear of its edges', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await startSignIn(page);

    // The sizes it was reported cropped at, plus the smallest the panel is shown at
    // and the largest we check. No reduced motion here on purpose: the icon drifts,
    // and the top of that drift is where it meets the panel's edge.
    const sizes = [
      { width: 1280, height: 720 },
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 1920, height: 1080 },
      { width: 901, height: 650 },
      { width: 2560, height: 1440 },
    ];
    const tooClose: string[] = [];

    for (const size of sizes) {
      await page.setViewportSize(size);
      await page.evaluate(() => new Promise(requestAnimationFrame));

      // Sampled across a whole drift cycle, which takes six seconds.
      for (let sample = 0; sample < 8; sample += 1) {
        const clearance = await page.evaluate(() => {
          const panel = document.querySelector('.cp-showcase-panel')!.getBoundingClientRect();
          const icon = document.querySelector('.cp-float')!.getBoundingClientRect();
          return {
            top: icon.top - panel.top,
            right: panel.right - icon.right,
            bottom: panel.bottom - icon.bottom,
            left: icon.left - panel.left,
          };
        });

        const nearest = Math.min(...Object.values(clearance));
        if (nearest < 32) {
          tooClose.push(`${size.width}x${size.height}: ${Math.round(nearest)}px`);
          break;
        }
        await page.waitForTimeout(400);
      }
    }

    // Inside the panel with room to spare, so neither an edge nor the 28px corner
    // radius can take a bite out of it.
    expect(tooClose).toEqual([]);
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
