import { test, expect, type Page, type Request } from '@playwright/test';

const PREVIEW = { status: 'running', project: 'support-triage', package: 'support_triage', startedAt: '2026-10-04T08:00:00Z' };

/** The builder replies and its tool starts a preview (state_delta, as the backend sends it). */
async function stubBuilderStartingPreview(page: Page) {
  await page.route('**/api/run_sse', async (route) => {
    const events = [
      { author: 'adk_agent_builder', content: { role: 'model', parts: [{ text: 'Your agent is running.' }] } },
      { author: 'adk_agent_builder', actions: { stateDelta: { 'builder:preview': PREVIEW } } },
    ];
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''),
    });
  });
}

/** /api/preview: status, a streamed reply from the preview agent, and stop. */
async function stubPreviewApi(page: Page, posts: Request[]) {
  await page.route('**/api/preview?**', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      await route.fulfill({ json: { success: true, data: { running: false } } });
    } else if (request.method() === 'DELETE') {
      await route.fulfill({ json: { success: true, data: { stopped: true } } });
    } else {
      posts.push(request);
      const event = { author: 'support_triage', content: { role: 'model', parts: [{ text: 'Hello from your agent.' }] } };
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: `data: ${JSON.stringify(event)}\n\n`,
      });
    }
  });
}

async function startBuild(page: Page) {
  await page.goto('/chat');
  const composer = page.locator('textarea').last();
  await expect(composer).toBeEnabled({ timeout: 30_000 });
  await composer.fill('Build a support triage agent');
  await composer.press('Enter');
  await expect(page.getByText('Your agent is running.')).toBeVisible({ timeout: 30_000 });
}

test.describe('Builder live preview', () => {
  test('opens next to the chat, talks to the agent, and stops', async ({ page }) => {
    const posts: Request[] = [];
    await stubBuilderStartingPreview(page);
    await stubPreviewApi(page, posts);
    await startBuild(page);

    const panel = page.getByRole('region', { name: 'Agent preview' });
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Preview · support-triage')).toBeVisible();
    await expect(panel.getByText('Running in a sandbox')).toBeVisible();

    const input = panel.getByRole('textbox', { name: 'Message your agent' });
    await input.fill('Hi agent');
    await input.press('Enter');
    await expect(panel.getByText('Hello from your agent.')).toBeVisible();
    expect(posts).toHaveLength(1);
    expect(posts[0].url()).toMatch(/\/api\/preview\?session_id=session-/);
    const body = posts[0].postDataJSON();
    expect(body.text).toBe('Hi agent');
    expect(body.previewSessionId).toMatch(/^[A-Za-z0-9._:-]+$/);

    // Close and reopen from the header.
    await panel.getByRole('button', { name: 'Close preview' }).click();
    await expect(panel).toBeHidden();
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.getByRole('region', { name: 'Agent preview' })).toBeVisible();

    await page.getByRole('button', { name: 'Stop the preview' }).click();
    const reopened = page.getByRole('region', { name: 'Agent preview' });
    await expect(reopened.getByText('Stopped', { exact: true })).toBeVisible();
    await expect(reopened.getByRole('textbox', { name: 'Message your agent' })).toBeDisabled();
  });

  test('takes the whole screen on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubBuilderStartingPreview(page);
    await stubPreviewApi(page, []);
    await startBuild(page);

    const panel = page.getByRole('region', { name: 'Agent preview' });
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box?.width).toBe(390);
    await panel.getByRole('button', { name: 'Close preview' }).click();
    await expect(page.getByText('Your agent is running.')).toBeVisible();
  });
});
