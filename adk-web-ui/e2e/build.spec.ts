import { test, expect, type Page, type Route } from '@playwright/test';

const BUILD = {
  name: 'research-summarizer',
  package: 'research_summarizer',
  description: 'Searches the web for a topic and writes a sourced one-page summary.',
  options: { with_eval: true, with_slack: false },
  models: { fast: 'openrouter/google/gemini-2.5-flash', reasoning: null },
  tools: ['web_search'],
  skills: ['sourced-summary'],
  artifact: 'research-summarizer.zip',
  version: 0,
  files: 41,
  bytes: 58213,
  packagedAt: '2026-10-04T09:12:00Z',
};
/** An empty zip (end-of-central-directory record only). */
const ZIP_DATA_URL = 'data:application/zip;base64,UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==';

/** A builder turn whose state_delta carries the build, as package_agent writes it. */
async function stubBuilderTurn(page: Page) {
  await page.route('**/api/run_sse', async (route) => {
    const event = {
      author: 'adk_agent_builder',
      content: { role: 'model', parts: [{ text: 'Packaged research-summarizer.' }] },
      actions: { state_delta: { 'builder:build': BUILD } },
    };
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: `data: ${JSON.stringify(event)}\n\n`,
    });
  });
}

/** /api/artifacts: the list the chat loads after a turn, and the single-artifact download. */
async function stubArtifacts(page: Page, requests: URL[], single: (route: Route) => Promise<void> = fulfillZip) {
  await page.route(
    (url) => url.pathname === '/api/artifacts',
    async (route) => {
      const url = new URL(route.request().url());
      requests.push(url);
      if (url.searchParams.get('artifact_name')) return single(route);
      return fulfillZip(route);
    },
  );
}

async function fulfillZip(route: Route) {
  await route.fulfill({
    json: { success: true, data: [{ id: BUILD.artifact, name: BUILD.artifact, type: 'file', url: ZIP_DATA_URL }] },
  });
}

async function getBuildCard(page: Page) {
  await page.goto('/chat');
  const composer = page.locator('textarea').last();
  await expect(composer).toBeEnabled({ timeout: 30_000 });
  await composer.fill('Build a research summarizer');
  await composer.press('Enter');
  const card = page.getByRole('group', { name: 'Build: research-summarizer' });
  await expect(card).toBeVisible({ timeout: 30_000 });
  return card;
}

test('the build card renders and the zip is not listed twice', async ({ page }) => {
  const requests: URL[] = [];
  await stubBuilderTurn(page);
  await stubArtifacts(page, requests);
  const listed = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/artifacts' && !new URL(r.url()).searchParams.get('artifact_name'),
  );
  const card = await getBuildCard(page);
  await listed;
  await expect(card).toBeVisible();
  await expect(page.getByText('Packaged research-summarizer.')).toBeVisible();
  await expect(card).toContainText('41 files · 1 tool · 1 skill · 56.8 KB');
  await expect(card.getByText('Eval', { exact: true })).toBeVisible();
  await expect(card.getByText('Slack', { exact: true })).toHaveCount(0);
  // After the turn the chat loads the session's artifacts; the zip is folded into the card.
  await expect.poll(() => requests.some((u) => !u.searchParams.get('artifact_name'))).toBe(true);
  await expect(page.getByText('research-summarizer.zip', { exact: true })).toHaveCount(0);
});

test('Download requests the single-artifact URL', async ({ page }) => {
  const requests: URL[] = [];
  await stubBuilderTurn(page);
  await stubArtifacts(page, requests);
  const card = await getBuildCard(page);
  const download = page.waitForEvent('download');
  await card.getByRole('button', { name: 'Download zip' }).click();
  expect((await download).suggestedFilename()).toBe('research-summarizer.zip');
  const single = requests.find((u) => u.searchParams.get('artifact_name'));
  expect(single?.searchParams.get('app_name')).toBe('adk_agent_builder');
  expect(single?.searchParams.get('artifact_name')).toBe('research-summarizer.zip');
  expect(single?.searchParams.get('version')).toBe('0');
  expect(single?.searchParams.get('session_id')).toMatch(/^session-/);
});

test('a lost zip asks to package it again', async ({ page }) => {
  await stubBuilderTurn(page);
  await stubArtifacts(page, [], (route) => route.fulfill({ status: 404, json: { success: false, code: 'not_found', error: 'x' } }));
  const card = await getBuildCard(page);
  await card.getByRole('button', { name: 'Download zip' }).click();
  await expect(card.getByRole('alert')).toContainText('package it again');
});

test('the email dialog posts the right body and shows Check your inbox', async ({ page }) => {
  const posted: unknown[] = [];
  await stubBuilderTurn(page);
  await stubArtifacts(page, []);
  // The API is covered by unit tests; here it is stubbed so the spec needs no DB, ADK or Resend.
  await page.route('**/api/builds', async (route) => {
    posted.push(route.request().postDataJSON());
    await route.fulfill({ json: { success: true, data: { id: 'x', sent: true, bookingUrl: 'https://cal.example.com/book' } } });
  });
  const card = await getBuildCard(page);
  await card.getByRole('button', { name: 'Email me a permanent link' }).click();

  const dialog = page.getByRole('dialog', { name: 'Email me a permanent link' });
  const send = dialog.getByRole('button', { name: 'Send link' });
  await expect(send).toBeDisabled();
  await expect(dialog.getByRole('checkbox', { name: 'Send me updates about the builder and nuvel' })).not.toBeChecked();
  await dialog.getByRole('textbox', { name: 'Email' }).fill('delivered@resend.dev');
  await dialog.getByRole('checkbox', { name: "I'd like help deploying it" }).check();
  await send.click();

  const done = page.getByRole('dialog', { name: 'Check your inbox' });
  await expect(done).toContainText('delivered@resend.dev');
  await expect(done.getByRole('link', { name: 'Book a call' })).toHaveAttribute('href', 'https://cal.example.com/book');
  expect(posted).toHaveLength(1);
  expect(posted[0]).toEqual({ email: 'delivered@resend.dev', sessionId: expect.stringMatching(/^session-/), updates: false, help: true });
});

test('dev mode shows the link itself', async ({ page }) => {
  await stubBuilderTurn(page);
  await stubArtifacts(page, []);
  await page.route('**/api/builds', (route) =>
    route.fulfill({ json: { success: true, data: { id: 'x', sent: false, link: 'http://localhost:3000/builds/abc' } } }),
  );
  const card = await getBuildCard(page);
  await card.getByRole('button', { name: 'Email me a permanent link' }).click();
  const dialog = page.getByRole('dialog', { name: 'Email me a permanent link' });
  await dialog.getByRole('textbox', { name: 'Email' }).fill('delivered@resend.dev');
  await dialog.getByRole('button', { name: 'Send link' }).click();
  const done = page.getByRole('dialog', { name: 'Your build link' });
  await expect(done.getByRole('link', { name: 'http://localhost:3000/builds/abc' })).toBeVisible();
});

test('the builds API validates input and rejects other origins', async ({ request, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const bad = await request.post('/api/builds', {
    headers: { Origin: origin },
    data: { email: 'nope', sessionId: 'session-1', updates: false, help: false },
  });
  expect(bad.status()).toBe(400);
  expect((await bad.json()).error).toMatch(/valid email/i);

  const foreign = await request.post('/api/builds', {
    headers: { Origin: 'https://evil.example' },
    data: { email: 'delivered@resend.dev', sessionId: 'session-1', updates: false, help: false },
  });
  expect(foreign.status()).toBe(403);
});

test('an unknown build link is a plain 404 that is never indexed', async ({ request }) => {
  const res = await request.get('/builds/not-a-token');
  expect(res.status()).toBe(404);
  expect(res.headers()['x-robots-tag']).toContain('noindex');
  expect(res.headers()['referrer-policy']).toBe('no-referrer');
  const zip = await request.get('/api/builds/not-a-token/zip');
  expect(zip.status()).toBe(404);
});

// Needs a real saved build: run the dev-mode flow (Task 5/7 manual steps) and
// export E2E_BUILD_TOKEN=<token from the logged link> before running.
test('the build page downloads and deletes (dev mode)', async ({ page, request }) => {
  const token = process.env.E2E_BUILD_TOKEN;
  test.skip(!token, 'set E2E_BUILD_TOKEN to a token from a dev-mode build link');
  await page.goto(`/builds/${token}`);
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download zip' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.zip$/);

  await page.getByRole('button', { name: 'Delete this build' }).click();
  await page.getByRole('button', { name: 'Yes, delete it' }).click();
  await expect(page.getByRole('heading', { name: 'Build deleted' })).toBeVisible();
  expect((await request.get(`/api/builds/${token}/zip`)).status()).toBe(404);
});
