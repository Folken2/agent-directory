import { test, expect } from '@playwright/test';

test.describe('Home dual-path CTA (anonymous)', () => {
  test('shows free + sign-in CTAs and upgrade explainer', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('button', { name: /try free agents/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in for more/i })).toBeVisible();
    await expect(page.getByText(/bring your own/i)).toHaveCount(0);
    await expect(page.getByText(/saved chat history/i)).toBeVisible();
    await expect(page.getByText(/not an official google product/i)).toBeVisible();

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

test('sort menu is keyboard accessible', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: /sort/i });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
});
