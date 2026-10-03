import { test, expect } from '@playwright/test';

test.describe('Visitor analytics ingest', () => {
  test('POST /api/analytics/pageview accepts a client beacon payload', async ({
    request,
  }) => {
    const res = await request.post('/api/analytics/pageview', {
      data: {
        path: '/about',
        query: '?utm_source=e2e',
        source: 'client',
        referrer: 'https://example.com/',
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.recorded).toBe('boolean');
    // With a real DATABASE_URL this is true; with a placeholder host it is false.
    if (body.recorded) {
      expect(body.id).toBeTruthy();
    } else {
      expect(['db_error', 'no_database', 'deduped', 'skipped_path']).toContain(
        body.reason
      );
    }
  });

  test('home visit does not set ad_vid until analytics consent', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const before = await context.cookies();
    expect(before.find((c) => c.name === 'ad_vid')).toBeFalsy();

    await page.getByRole('button', { name: 'Accept' }).click();
    await page.waitForTimeout(300);
    const after = await context.cookies();
    const vid = after.find((c) => c.name === 'ad_vid');
    const consent = after.find((c) => c.name === 'ad_consent');
    expect(consent?.value).toBe('all');
    expect(vid?.value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  test('GET /api/analytics/stats returns a stats payload', async ({ request }) => {
    const res = await request.get('/api/analytics/stats');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.stats).toBeTruthy();
    expect(typeof body.stats.total).toBe('number');
  });

  const statsWith = (visits: number) => ({
    ok: true,
    stats: { total: visits, humans: visits, visits, bots: 0, timeline: [], topCountries: [], byBot: [], topAgents: [] },
  });

  test('hides the footer visit count when there are no real visits', async ({ page }) => {
    await page.route('**/api/analytics/stats*', (r) => r.fulfill({ json: statsWith(0) }));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('link', { name: /visits$/i })).toHaveCount(0);
  });

  test('footer shows all-time visits linking to the dashboard', async ({ page }) => {
    await page.route('**/api/analytics/stats*', (r) => r.fulfill({ json: statsWith(3456) }));
    await page.goto('/');
    const link = page.getByRole('contentinfo').getByRole('link', { name: '3.5k visits' });
    await expect(link).toHaveAttribute('href', '/analytics');
  });
});
