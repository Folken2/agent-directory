import { test, expect } from '@playwright/test';

const cases: Array<[string, string]> = [
  ['/trending', '/'],
  ['/learn', '/'],
  ['/contribute', '/about'],
  ['/contribute/submit', '/about'],
];

test.describe('Removed pages redirect', () => {
  for (const [from, to] of cases) {
    test(`${from} → ${to} (permanent)`, async ({ request }) => {
      const res = await request.get(from, { maxRedirects: 0 });
      expect(res.status()).toBe(308);
      expect(new URL(res.headers()['location'], 'http://x').pathname).toBe(to);
    });
  }

  test('nav has no links to removed pages', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation');
    for (const name of ['Trending', 'Contribute', 'Learn', 'More']) {
      await expect(nav.getByRole('link', { name, exact: true })).toHaveCount(0);
    }
  });
});
