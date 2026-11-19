import { test, expect } from '@playwright/test';

// First smoke test: the app loads and uses the ConSAP brand font.
// Extend with one test per MVP feature (tag the title with its ID, e.g. "M09 leave approval").
test('home page loads with the CPeople brand', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/CPeople/);
  const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(font).toContain('Montserrat');
});
