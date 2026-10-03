import { test, expect, type Page } from '@playwright/test';

const BUILDER = 'adk_agent_builder';

/** Stub the streaming endpoint so the chat works without an ADK backend. */
async function stubRunSse(page: Page) {
  const bodies: Array<{ app_name: string; new_message: { parts: Array<{ text?: string }> } }> = [];
  await page.route('**/api/run_sse', async (route) => {
    bodies.push(route.request().postDataJSON());
    const event = { author: BUILDER, content: { role: 'model', parts: [{ text: 'Stubbed builder reply.' }] } };
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: `data: ${JSON.stringify(event)}\n\n`,
    });
  });
  return bodies;
}

test.describe('Home: builder hero', () => {
  test('submitting the hero composer opens a builder chat and sends the prompt', async ({ page }) => {
    const bodies = await stubRunSse(page);
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/agent do you want to build/i);
    const composer = page.getByRole('textbox', { name: /describe the agent you want to build/i });
    const submit = page.getByRole('button', { name: 'Start building' });
    await expect(submit).toBeDisabled();

    await composer.fill('An agent that plans weekend hikes');
    await composer.press('Enter');

    await expect(page).toHaveURL(new RegExp(`/chat\\?agent=${BUILDER}`));
    await expect(page.getByText('Stubbed builder reply.')).toBeVisible({ timeout: 30_000 });
    expect(bodies).toHaveLength(1);
    expect(bodies[0].app_name).toBe(BUILDER);
    expect(bodies[0].new_message.parts[0].text).toBe('An agent that plans weekend hikes');
    // The prompt is dropped from the URL so a refresh doesn't resend it.
    await expect(page).not.toHaveURL(/prompt=/);
    await expect(page).not.toHaveURL(/send=1/);
  });

  test('example chips fill the composer without navigating', async ({ page }) => {
    await page.goto('/');
    const chips = page.getByLabel('Example ideas').getByRole('button');
    await expect(chips).toHaveCount(4);
    await chips.first().click();
    const composer = page.getByRole('textbox', { name: /describe the agent you want to build/i });
    await expect(composer).not.toHaveValue('');
    await expect(composer).toBeFocused();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: 'Start building' })).toBeEnabled();
  });

  test('examples grid lists agents other than the builder and links to all examples', async ({ page }) => {
    await page.goto('/');
    const examples = page.getByRole('region', { name: 'Examples' });
    const cards = examples.getByRole('heading', { level: 3 });
    // /api/agents can take several seconds to fall back to the bundled catalog.
    await expect(cards).toHaveCount(4, { timeout: 30_000 });
    await expect(examples.getByRole('link', { name: 'ADK Agent Builder' })).toHaveCount(0);
    await expect(page.getByText(/not an official google product/i)).toBeVisible();

    await examples.getByRole('link', { name: /browse all examples/i }).click();
    await expect(page).toHaveURL(/\/examples$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Examples' })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Search examples' })).toBeVisible();
  });
});

test('/chat with no agent defaults to the builder', async ({ page }) => {
  const bodies = await stubRunSse(page);
  await page.goto('/chat');
  await expect(page.getByRole('button', { name: /Agent: ADK Agent Builder/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/select an agent to begin/i)).toHaveCount(0);

  const composer = page.locator('textarea').last();
  await expect(composer).toBeEnabled();
  await composer.fill('Hello builder');
  await composer.press('Enter');
  await expect(page.getByText('Stubbed builder reply.')).toBeVisible({ timeout: 30_000 });
  expect(bodies[0]?.app_name).toBe(BUILDER);
});

test('/chat?prompt without send=1 prefills instead of sending', async ({ page }) => {
  const bodies = await stubRunSse(page);
  await page.goto(`/chat?agent=${BUILDER}&prompt=${encodeURIComponent('Draft only')}`);
  await expect(page.locator('textarea').last()).toHaveValue('Draft only', { timeout: 30_000 });
  expect(bodies).toHaveLength(0);
});

test('examples sort menu is keyboard accessible', async ({ page }) => {
  await page.goto('/examples');
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
