import { test, expect } from '@playwright/test';

const PAGES = ['/', '/examples', '/about', '/privacy', '/auth/signin', '/agents/deep_research_agent', '/definitely-missing-page'];

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });
    for (const path of PAGES) {
      test(`${path} renders without console errors`, async ({ page, baseURL }) => {
        const errors: string[] = [];
        const origin = new URL(baseURL ?? 'http://localhost:3000').origin;
        page.on('console', (m) => {
          if (m.type() !== 'error') return;
          const source = m.location().url;
          // Agent logos are third-party images that may be unreachable; the page falls back to a letter.
          if (/^Failed to load resource/.test(m.text()) && source && !source.startsWith(origin)) return;
          errors.push(`${m.text()} ${source}`);
        });
        await page.goto(path);
        await expect(page.locator('main')).toBeVisible();
        expect(await page.locator('html').evaluate((el) => el.classList.contains('dark'))).toBe(scheme === 'dark');
        // The missing-page document itself is a 404, which Chromium reports as a console error.
        const ignore = path === '/definitely-missing-page' ? /Content Security Policy|favicon|status of 404/i : /Content Security Policy|favicon/i;
        expect(errors.filter((e) => !ignore.test(e))).toEqual([]);
      });
    }
  });
}
