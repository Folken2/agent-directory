import { test, expect } from '@playwright/test';

function fixture(range: string) {
  const days = range === '7' ? 7 : 30;
  const timeline = Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 1 + i));
    const humans = 20 + i;
    const bots = 10;
    return { day: d.toISOString().slice(0, 10), humans, bots, total: humans + bots };
  });
  return {
    ok: true,
    stats: {
      total: 1500,
      humans: 1200,
      visits: 1200,
      bots: 300,
      peopleApprox: 400,
      returning: 90,
      previous: range === 'all' ? null : { visits: 1000, peopleApprox: 500, returning: 90, bots: 300 },
      topPages: [
        { id: '/', label: 'Home', count: 700, share: 58.3 },
        { id: '/agents/deep_research_agent', label: 'Agent: Deep Research Agent', count: 500, share: 41.7 },
      ],
      topSources: [{ id: 'google.com', label: 'google.com', count: 800, share: 66.7 }],
      devices: [{ id: 'desktop', label: 'Desktop', count: 1200, share: 100 }],
      topCountries: [{ country: 'ES', name: 'Spain', flag: '🇪🇸', count: 1200, share: 100 }],
      botCompanies: [],
      byBot: [],
      topAgents: [],
      timeline,
      timelineRange: range,
    },
  };
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/analytics/stats**', (route) => {
    const range = new URL(route.request().url()).searchParams.get('range') ?? '30';
    return route.fulfill({ json: fixture(range) });
  });
});

test('KPIs show period-over-period change with direction not by color alone', async ({ page }) => {
  await page.goto('/analytics');
  await expect(page.getByText('1,200').first()).toBeVisible();
  await expect(page.getByText('+20%')).toBeVisible(); // visits 1200 vs 1000
  await expect(page.getByText('-20%')).toBeVisible(); // people 400 vs 500
  await expect(page.getByText('vs prior 30 days').first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Top pages' })).toContainText('Agent: Deep Research Agent');
  await expect(page.getByRole('region', { name: 'Sources' })).toContainText('google.com');
});

test('the date range scopes the whole page', async ({ page }) => {
  await page.goto('/analytics');
  const range = page.getByRole('radiogroup', { name: 'Date range' });
  await expect(range.getByRole('radio', { name: '30 days' })).toHaveAttribute('aria-checked', 'true');
  const req = page.waitForRequest((r) => r.url().includes('range=7'));
  await range.getByRole('radio', { name: '7 days' }).click();
  await req;
  await expect(page.getByText('vs prior 7 days').first()).toBeVisible();

  await range.getByRole('radio', { name: '7 days' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(range.getByRole('radio', { name: '30 days' })).toBeFocused();
  await expect(range.getByRole('radio', { name: '30 days' })).toHaveAttribute('aria-checked', 'true');
});

test('chart values are reachable by keyboard and as a table', async ({ page }) => {
  await page.goto('/analytics');
  const chart = page.getByRole('group', { name: /Daily visits chart/ });
  await chart.focus();
  await page.keyboard.press('End');
  const tip = page.getByRole('status').filter({ hasText: 'people' });
  await expect(tip).toContainText('49'); // last day: 20 + 29 people
  await expect(tip).toContainText('10');

  await page.getByRole('button', { name: 'Show data table' }).click();
  const table = page.getByRole('table', { name: 'Daily visits' });
  await expect(table.getByRole('row')).toHaveCount(31);
});
