import { test, expect } from '@playwright/test';

test('agent detail: start chat and share via snackbar', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });

  await page.goto('/agents/deep_research_agent');
  await expect(page.getByRole('link', { name: /try it in chat/i })).toHaveAttribute(
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

test('agent pages are server-rendered with per-agent metadata', async ({ request }) => {
  const res = await request.get('/agents/deep_research_agent');
  expect(res.ok()).toBe(true);
  const html = await res.text();
  expect(html).toMatch(/<meta property="og:title" content="[^"]*Deep Research[^"]*"/i);
  expect(html).toMatch(/<title>[^<]*Deep Research[^<]*<\/title>/i);
  expect(html).toContain('href="/chat?agent=deep_research_agent"');

  const missing = await request.get('/agents/no_such_agent');
  expect(missing.status()).toBe(404);
});
