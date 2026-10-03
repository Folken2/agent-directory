import { test, expect } from '@playwright/test';

test.describe('Settings shell', () => {
  test('anonymous /settings redirects to sign-in with callback', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/auth\/signin/);
    const url = decodeURIComponent(page.url());
    expect(url).toContain('callbackUrl');
    expect(url).toContain('/settings');
  });

  for (const retired of ['/settings/keys', '/settings/connections']) {
    test(`${retired} redirects to /settings`, async ({ request }) => {
      const res = await request.get(retired, { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      expect(new URL(res.headers()['location'], 'http://x').pathname).toBe('/settings');
    });
  }

  test('sign-in page passes the callback to Google sign-in', async ({ page, baseURL }) => {
    // Stub Auth.js so the click resolves without a configured Google provider.
    await page.route('**/api/auth/csrf', (r) => r.fulfill({ json: { csrfToken: 'e2e' } }));
    await page.route('**/api/auth/providers', (r) =>
      r.fulfill({
        json: {
          google: {
            id: 'google',
            name: 'Google',
            type: 'oidc',
            signinUrl: `${baseURL}/api/auth/signin/google`,
            callbackUrl: `${baseURL}/api/auth/callback/google`,
          },
        },
      })
    );
    let posted = '';
    await page.route('**/api/auth/signin/google*', (r) => {
      posted = r.request().postData() ?? '';
      return r.fulfill({ json: { url: `${baseURL}/about` } });
    });

    await page.goto('/auth/signin?callbackUrl=%2Fme%2Fsessions');
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
    await expect(page.getByText(/terms of service/i)).toHaveCount(0);
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await expect.poll(() => new URLSearchParams(posted).get('callbackUrl')).toBe('/me/sessions');
  });

  test('sign-in ignores an off-site callback', async ({ page, baseURL }) => {
    await page.route('**/api/auth/csrf', (r) => r.fulfill({ json: { csrfToken: 'e2e' } }));
    await page.route('**/api/auth/providers', (r) =>
      r.fulfill({ json: { google: { id: 'google', name: 'Google', type: 'oidc', signinUrl: '', callbackUrl: '' } } })
    );
    let posted = '';
    await page.route('**/api/auth/signin/google*', (r) => {
      posted = r.request().postData() ?? '';
      return r.fulfill({ json: { url: `${baseURL}/about` } });
    });
    await page.goto('/auth/signin?callbackUrl=https%3A%2F%2Fevil.example%2F');
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await expect.poll(() => new URLSearchParams(posted).get('callbackUrl')).toBe('/');
  });

  test('signed-out nav does not show Settings', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Settings' })).toHaveCount(
      0
    );
  });
});

test.describe('Signed-out redirects are real HTTP redirects', () => {
  for (const [path, callback] of [
    ['/settings', '/settings'],
    ['/me/sessions', '/me/sessions'],
  ] as const) {
    test(`${path} answers 307 to sign-in`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      const location = new URL(res.headers()['location'], 'http://x');
      expect(location.pathname).toBe('/auth/signin');
      expect(location.searchParams.get('callbackUrl')).toBe(callback);
    });
  }
});
