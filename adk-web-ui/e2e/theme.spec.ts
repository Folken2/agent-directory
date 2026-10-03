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

  test('no flash: class comes from the inline head script, not hydration', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    // With the app bundles blocked, nothing can hydrate; only the inline
    // head script can set the class.
    await page.route('**/_next/static/**/*.js', (r) => r.abort());
    await page.goto('/about');
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    await ctx.close();
  });

  test('follows OS scheme changes while preference is system', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto('/about');
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
    await ctx.close();
  });
});
