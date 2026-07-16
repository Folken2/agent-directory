import { test, expect } from '@playwright/test';

test.describe('Settings shell', () => {
  test('anonymous /settings redirects to sign-in with callback', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/auth\/signin/);
    const url = decodeURIComponent(page.url());
    expect(url).toContain('callbackUrl');
    expect(url).toContain('/settings');
  });

  test('anonymous /settings/keys redirects to sign-in', async ({ page }) => {
    await page.goto('/settings/keys');
    await expect(page).toHaveURL(/\/auth\/signin/);
    expect(decodeURIComponent(page.url())).toContain('/settings/keys');
  });

  test('anonymous /settings/connections redirects to sign-in', async ({ page }) => {
    await page.goto('/settings/connections');
    await expect(page).toHaveURL(/\/auth\/signin/);
    expect(decodeURIComponent(page.url())).toContain('/settings/connections');
  });

  test('signed-out nav does not show Settings', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Settings' })).toHaveCount(
      0
    );
  });
});
