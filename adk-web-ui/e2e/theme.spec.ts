import { test, expect } from '@playwright/test';

test.describe('Theme', () => {
  test('follows system dark preference on first load', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto('/about');
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    await ctx.close();
  });

  test('explicit choice persists across reload and beats system', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto('/about');
    await page.getByRole('radiogroup', { name: 'Theme' }).first().getByRole('radio', { name: 'Light' }).click();
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
    await page.reload();
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
    await ctx.close();
  });

  test('no flash: class is set before hydration', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      (window as unknown as { __firstPaintDark?: boolean }).__firstPaintDark = undefined;
      document.addEventListener('DOMContentLoaded', () => {
        (window as unknown as { __firstPaintDark?: boolean }).__firstPaintDark =
          document.documentElement.classList.contains('dark');
      });
    });
    await page.goto('/about');
    expect(await page.evaluate(() => (window as unknown as { __firstPaintDark?: boolean }).__firstPaintDark)).toBe(true);
    await ctx.close();
  });
});
