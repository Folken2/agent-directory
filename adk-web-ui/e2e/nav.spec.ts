import { test, expect } from '@playwright/test';

test('desktop nav shows destinations and theme switch', async ({ page }) => {
  await page.goto('/about');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Agents' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'About' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('radiogroup', { name: 'Theme' })).toBeVisible();
});

test('theme radio group supports arrow-key navigation with roving tabindex', async ({ page }) => {
  await page.goto('/about');
  const group = page.getByRole('navigation', { name: 'Main' }).getByRole('radiogroup', { name: 'Theme' });
  const checked = group.locator('[role="radio"][aria-checked="true"]');
  await expect(checked).toHaveCount(1);
  await expect(group.locator('[role="radio"][tabindex="0"]')).toHaveCount(1);
  await expect(group.locator('[role="radio"][tabindex="-1"]')).toHaveCount(2);
  const order = ['Light', 'Dark', 'System'];
  const current = (await checked.getAttribute('aria-label')) as string;
  const next = order[(order.indexOf(current) + 1) % order.length];
  await checked.focus();
  await page.keyboard.press('ArrowRight');
  const nextRadio = group.getByRole('radio', { name: next });
  await expect(nextRadio).toBeChecked();
  await expect(nextRadio).toBeFocused();
});

test('mobile menu is an accessible sheet', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto('/about');
  await expect(page.getByRole('link', { name: 'Agent Directory home' })).toBeVisible();
  await page.getByRole('button', { name: 'Open menu' }).click();
  const dialog = page.getByRole('dialog', { name: 'Menu' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Agents' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused();
  await ctx.close();
});
