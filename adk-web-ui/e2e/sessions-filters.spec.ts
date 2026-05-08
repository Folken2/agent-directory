import { test, expect } from '@playwright/test';

/**
 * Pins the agent quick-filter chips and live search on /me/sessions
 * (PR #14). Two regressions worth catching:
 *
 *   - Search input doesn't actually filter (the bind is wrong, the
 *     filter pipeline is short-circuited, etc.)
 *   - Chip click doesn't narrow to that agent (toggle logic regressed,
 *     the slug lookup mismatched)
 *
 * Both specs require E2E_TEST_USER_ID to be set to a users.id with
 * sessions across ≥2 agents. They skip gracefully otherwise so the
 * suite still passes without a DB seed.
 */

const TEST_USER_ID = process.env.E2E_TEST_USER_ID;
const hasAuthedFixture = !!TEST_USER_ID;

const sessionLinks = (page: import('@playwright/test').Page) =>
  page.locator('a[href^="/chat?agent="][href*="session="]');

test.describe('Sessions filters (authenticated)', () => {
  test.skip(!hasAuthedFixture, 'set E2E_TEST_USER_ID to enable authed specs');

  test('search with no-match query shows the empty state, clearing brings sessions back', async ({ page }) => {
    await page.goto('/me/sessions');

    // Wait for the initial card list to render.
    const links = sessionLinks(page);
    const initialCount = await links.count();
    test.skip(initialCount === 0, 'test user has no sessions');

    const searchInput = page.getByPlaceholder(/search past messages/i);
    await expect(searchInput).toBeVisible();

    // A query no real first-message would contain. Picks gibberish so we
    // don't have to know anything about the test user's actual data.
    await searchInput.fill('zzzzzzzzz_no_match_xyz');

    await expect(page.getByRole('heading', { name: /no sessions match/i })).toBeVisible();
    await expect(links).toHaveCount(0);

    // Clear via the × button next to the input.
    await page.getByRole('button', { name: /clear search/i }).click();
    await expect(searchInput).toHaveValue('');
    await expect(links).toHaveCount(initialCount);
  });

  test('clicking an agent chip narrows the visible cards to that agent', async ({ page }) => {
    await page.goto('/me/sessions');

    const links = sessionLinks(page);
    const initialCount = await links.count();
    test.skip(initialCount === 0, 'test user has no sessions');

    // The chip row is hidden when the user has only used one agent. Skip
    // the chip-narrow test in that case — the implementation is correctly
    // avoiding a single-option filter.
    const allChip = page.getByRole('button', { name: /^All$/ });
    if (!(await allChip.isVisible().catch(() => false))) {
      test.skip(true, 'test user has only used one agent');
    }

    // Pick the first non-"All" chip. It carries the agent's display name
    // followed by a count badge.
    const firstAgentChip = page.locator('button').filter({
      hasText: /^(?!All$).+\s\d+$/,
    }).first();
    await expect(firstAgentChip).toBeVisible();
    const chipText = (await firstAgentChip.innerText()).trim();
    // Text format: "<displayName> <count>". Pull the count off the end
    // and the display-name lookup-key off the front.
    const match = chipText.match(/^(.+?)\s(\d+)$/);
    expect(match, `chip text "${chipText}" should match "<name> <count>"`).not.toBeNull();
    const expectedCount = Number(match![2]);

    await firstAgentChip.click();

    // After narrowing, every visible card should link to the same agent
    // slug. We don't know the slug from the chip text (display names get
    // formatted), so we just assert the count matches what the chip
    // promised AND every link shares one agent slug.
    await expect(links).toHaveCount(expectedCount);

    const hrefs = await links.evaluateAll((els) =>
      els.map((el) => (el as HTMLAnchorElement).getAttribute('href') || '')
    );
    const slugs = new Set(
      hrefs.map((h) => {
        const u = new URL(h, 'http://localhost');
        return u.searchParams.get('agent') ?? '';
      })
    );
    expect(slugs.size).toBe(1);
  });
});
