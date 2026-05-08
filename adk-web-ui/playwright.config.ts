import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the chat-surface end-to-end tests.
 *
 * Local run:
 *   E2E_TEST_USER_ID=<uuid-of-a-real-user> npm run test:e2e
 *
 * Without E2E_TEST_USER_ID, only the unauthenticated smoke tests run; the
 * authenticated specs are skipped (see e2e/resume.spec.ts).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Spin up the dev server automatically when no E2E_BASE_URL is provided.
  // The auth bypass requires E2E_TEST_USER_ID to be present in the same env;
  // the test runner inherits env from the parent shell.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
});
