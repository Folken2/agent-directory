import { test, expect, type Page } from '@playwright/test';

async function stubRunSse(page: Page, author = 'adk_agent_builder') {
  await page.route('**/api/run_sse', async (route) => {
    const event = { author, content: { role: 'model', parts: [{ text: 'Stubbed reply.' }] } };
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: `data: ${JSON.stringify(event)}\n\n`,
    });
  });
}

async function send(page: Page, text: string) {
  const composer = page.locator('textarea').last();
  await expect(composer).toBeEnabled({ timeout: 30_000 });
  await composer.fill(text);
  await composer.press('Enter');
}

test.describe('Chat workspace', () => {
  test('fills the viewport and shows the not-affiliated notice under the composer', async ({ page }) => {
    await page.goto('/chat');
    await expect(page.locator('textarea').last()).toBeEnabled({ timeout: 30_000 });
    const gap = await page.evaluate(() => {
      // The site footer (hidden on /chat) carries the same text; take the visible copy.
      const notice = [...document.querySelectorAll('p')].find(
        (p) => /not an official google product/i.test(p.textContent ?? '') && p.getBoundingClientRect().height > 0,
      );
      return window.innerHeight - (notice?.getBoundingClientRect().bottom ?? 0);
    });
    // Composer chrome sits at the bottom: no 4rem dead band below it.
    expect(gap).toBeLessThan(40);
    expect(gap).toBeGreaterThanOrEqual(0);
  });

  test('agent switcher opens a fresh chat with another agent', async ({ page }) => {
    await page.goto('/chat');
    const trigger = page.getByRole('button', { name: /Agent: ADK Agent Builder/ });
    await expect(trigger).toBeVisible({ timeout: 30_000 });
    await trigger.click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitemradio', { name: 'ADK Agent Builder' })).toHaveAttribute('aria-checked', 'true', {
      timeout: 30_000,
    });
    await menu.getByRole('menuitemradio', { name: 'Deep Research Agent' }).click();
    await expect(page).toHaveURL(/agent=deep_research_agent/);
    await expect(page.getByRole('button', { name: /Agent: Deep Research Agent/ })).toBeVisible();
  });

  test('anonymous conversation survives a refresh, per agent', async ({ page }) => {
    await stubRunSse(page);
    await page.goto('/chat');
    await send(page, 'Remember this message');
    await expect(page.getByText('Stubbed reply.')).toBeVisible({ timeout: 30_000 });

    await page.reload();
    // Also matches the sidebar title, so take the first (the message bubble).
    await expect(page.getByText('Remember this message').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Stubbed reply.')).toBeVisible();

    // Another agent has its own (empty) slot.
    await page.goto('/chat?agent=deep_research_agent');
    await expect(page.getByRole('button', { name: /Agent: Deep Research Agent/ })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Remember this message')).toHaveCount(0);
  });
});
