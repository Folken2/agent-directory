import { test, expect, type Page } from '@playwright/test';

const BLUEPRINT = {
  name: 'Support triage',
  goal: 'Triage support emails and draft replies.',
  agents: [
    { name: 'root_agent', role: 'Routes incoming emails', kind: 'sequential', subAgents: ['drafter'] },
    { name: 'drafter', role: 'Drafts replies', model: 'gemini-2.5-flash', tools: ['search_kb'] },
  ],
  tools: [{ name: 'search_kb', kind: 'function', purpose: 'Search the help center' }],
  risks: ['Wrong refunds'],
  nextSteps: ['Write search_kb'],
};

/** A builder turn whose state_delta carries the blueprint, as the backend callback emits it. */
async function stubBuilderTurn(page: Page) {
  await page.route('**/api/run_sse', async (route) => {
    const event = {
      author: 'adk_agent_builder',
      content: { role: 'model', parts: [{ text: 'Here is the design.' }] },
      actions: { state_delta: { 'blueprint:document': BLUEPRINT } },
    };
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: `data: ${JSON.stringify(event)}\n\n`,
    });
  });
}

async function getBlueprint(page: Page) {
  await stubBuilderTurn(page);
  await page.goto('/chat');
  const composer = page.locator('textarea').last();
  await expect(composer).toBeEnabled({ timeout: 30_000 });
  await composer.fill('Design a support triage agent');
  await composer.press('Enter');
  const card = page.getByRole('group', { name: 'Blueprint: Support triage' });
  await expect(card).toBeVisible({ timeout: 30_000 });
  return card;
}

test('builder reply renders a blueprint card and side panel', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const card = await getBlueprint(page);
  await expect(card).toContainText('2 agents · 1 tool');
  await expect(page.getByText('Here is the design.')).toBeVisible();

  await card.getByRole('button', { name: 'Open blueprint' }).click();
  const panel = page.getByRole('dialog', { name: 'Blueprint' });
  await expect(panel.getByRole('heading', { name: 'Support triage' })).toBeVisible();
  await expect(panel.getByText('Routes incoming emails')).toBeVisible();
  await panel.getByRole('button', { name: 'Copy as Markdown' }).click();
  await expect(panel.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('# Support triage');

  const download = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Download' }).click();
  expect((await download).suggestedFilename()).toBe('support-triage-blueprint.md');
});

test('saving requires consent, then shows the booking link', async ({ page }) => {
  const posted: unknown[] = [];
  // The API itself is covered by unit tests and a local-DB check; here we
  // stub it so the spec runs without a database.
  await page.route('**/api/blueprints', async (route) => {
    posted.push(route.request().postDataJSON());
    await route.fulfill({ json: { success: true, data: { id: 'x', bookingUrl: 'https://cal.example.com/book' } } });
  });
  const card = await getBlueprint(page);
  await card.getByRole('button', { name: 'Save blueprint' }).click();

  const dialog = page.getByRole('dialog', { name: 'Save your blueprint?' });
  await dialog.getByRole('textbox', { name: 'Email' }).fill('me@example.com');
  const save = dialog.getByRole('button', { name: 'Save', exact: true });
  await expect(save).toBeDisabled();
  await dialog.getByRole('checkbox').check();
  await expect(save).toBeEnabled();
  await save.click();

  const done = page.getByRole('dialog', { name: 'Blueprint saved' });
  await expect(done.getByRole('link', { name: 'Book a call' })).toHaveAttribute('href', 'https://cal.example.com/book');
  expect(posted).toHaveLength(1);
  expect(posted[0]).toMatchObject({ email: 'me@example.com', consent: true, blueprint: { name: 'Support triage' } });
});

test('the save API rejects a submission without consent', async ({ request, baseURL }) => {
  const res = await request.post('/api/blueprints', {
    headers: { Origin: new URL(baseURL!).origin },
    data: { email: 'me@example.com', consent: false, blueprint: BLUEPRINT },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toMatch(/agree to be contacted/i);
});
