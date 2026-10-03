import { test, expect } from '@playwright/test';

test('desktop nav shows destinations and theme switch', async ({ page }) => {
  await page.goto('/about');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Build' })).toHaveAttribute('href', '/');
  await expect(nav.getByRole('link', { name: 'Examples' })).toHaveAttribute('href', '/examples');
  await expect(nav.getByRole('link', { name: 'Agents' })).toHaveCount(0);
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
  const trigger = page.getByRole('button', { name: 'Open menu' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Menu' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Build' })).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Examples' })).toBeVisible();
  const inside = () => dialog.evaluate((d) => d.contains(document.activeElement));
  await expect.poll(inside).toBe(true);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await inside()).toBe(true);
  }
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Shift+Tab');
    expect(await inside()).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await ctx.close();
});

test('signed-in account menu opens, lists Sign out, and Escape restores focus', async ({ page }) => {
  await page.route('**/api/auth/session', (r) =>
    r.fulfill({
      json: {
        user: { name: 'E2E Test User', email: 'e2e@localhost.test' },
        expires: '2099-01-01T00:00:00.000Z',
      },
    })
  );
  await page.goto('/about');
  const trigger = page.getByRole('button', { name: 'Account' });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Settings' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
});
