import { test, expect } from '@playwright/test';

test.describe('Chat chrome', () => {
  test('empty chat does not show Gemini powered-by clutter', async ({ page }) => {
    // Prefer a live agent from the directory; fall back to the known stub name
    // used when the ADK backend is unavailable during local e2e.
    let agentName = 'image_generation_agent';
    const res = await page.request.get('/api/agents');
    if (res.ok()) {
      const json = await res.json();
      const agents: Array<{ name: string }> = Array.isArray(json?.data) ? json.data : [];
      if (agents[0]?.name) agentName = agents[0].name;
    }

    await page.goto(`/chat?agent=${encodeURIComponent(agentName)}`);
    await expect(page.getByText(/powered by gemini/i)).toHaveCount(0);
  });
});
