import { test, expect } from '@playwright/test';

test.describe('Home dual-path CTA (anonymous)', () => {
  test('shows free + sign-in CTAs and upgrade explainer', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('button', { name: /try free agents/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in for more/i })).toBeVisible();
    await expect(page.getByText(/bring your own/i)).toBeVisible();
    await expect(page.getByText(/gmail/i)).toBeVisible();
    await expect(page.getByText(/mcp/i)).toBeVisible();

    // Repo link must not look like a primary CTA competitor — still present
    await expect(page.getByRole('link', { name: /view repository/i })).toBeVisible();
  });

  test('Try free agents scrolls to agents section', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /try free agents/i }).click();
    await expect(page.locator('#agents-section')).toBeInViewport();
  });

  test('Sign in for more goes to auth', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /sign in for more/i }).click();
    await expect(page).toHaveURL(/\/auth\/signin/);
  });
});
