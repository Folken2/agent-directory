import { test, expect } from '@playwright/test';

test('home goes from the composer straight to examples', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'How it works' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Examples' }).getByRole('heading', { level: 3 })).toHaveCount(4);
});

test('agent page hands off to the builder with an editable prompt', async ({ page }) => {
  await page.goto('/agents/deep_research_agent');
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Examples' })).toHaveAttribute('href', '/examples');
  const adapt = page.getByRole('link', { name: /adapt this agent in the builder/i });
  const href = new URL((await adapt.getAttribute('href')) ?? '', 'http://x');
  expect(href.pathname).toBe('/chat');
  expect(href.searchParams.get('agent')).toBe('adk_agent_builder');
  expect(href.searchParams.get('prompt')).toContain('Deep Research Agent');
  expect(href.searchParams.has('send')).toBe(false);
  // Related examples exclude the current agent.
  const more = page.getByRole('region', { name: 'More examples' });
  await expect(more.getByRole('heading', { level: 3 })).toHaveCount(4);
  await expect(more.getByRole('link', { name: 'Deep Research Agent' })).toHaveCount(0);
});

test('examples page ends with the builder composer', async ({ page }) => {
  await page.goto('/examples');
  const cta = page.getByRole('region', { name: 'Build your own agent' });
  await expect(cta.getByRole('textbox', { name: /describe the agent you want to build/i })).toBeVisible();
});

test('404 offers the builder and examples instead of a dead end', async ({ page }) => {
  const res = await page.goto('/no-such-page');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /describe the agent you were looking for/i })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Or start from an example' }).getByRole('heading', { level: 3 })).toHaveCount(4);
});

test('sign-in explains what an account adds', async ({ page }) => {
  await page.goto('/auth/signin?callbackUrl=%2Fchat%3Fagent%3Ddeep_research_agent');
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  await expect(page.getByText(/messages a day instead of/i)).toBeVisible();
  // A chat callback can be resumed without an account.
  await expect(page.getByRole('link', { name: 'Continue without signing in' })).toHaveAttribute(
    'href',
    '/chat?agent=deep_research_agent'
  );
});

test('sign-in from an account page offers the examples instead of looping', async ({ page }) => {
  await page.goto('/auth/signin?callbackUrl=%2Fsettings');
  await expect(page.getByRole('link', { name: 'Try the examples without an account' })).toHaveAttribute('href', '/examples');
});
