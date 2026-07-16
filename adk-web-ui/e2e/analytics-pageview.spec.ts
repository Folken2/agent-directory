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

  test('home visit sets ad_vid cookie via middleware', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const cookies = await context.cookies();
    const vid = cookies.find((c) => c.name === 'ad_vid');
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

  test('hides visit pill when there are no real visits', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    // With placeholder / empty DB the badge must not show demo numbers.
    await expect(page.getByRole('link', { name: /visits$/i })).toHaveCount(0);
  });
});
