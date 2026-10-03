import { test, expect } from '@playwright/test';

test('agent detail: start chat and share via snackbar', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });

  await page.goto('/agents/deep_research_agent');
  await expect(page.getByRole('link', { name: /start chat/i })).toHaveAttribute(
    'href',
    /\/chat\?agent=deep_research_agent/,
    { timeout: 20_000 } // /api/agents can take several seconds to fall back to the bundled catalog
  );
  // Make sure the clipboard path is exercised regardless of native share support.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });
  await page.getByRole('button', { name: /share/i }).click();
  await expect(page.getByText(/link copied/i)).toBeVisible();
  expect(dialogs, 'native alert() must not be used').toEqual([]);
});
