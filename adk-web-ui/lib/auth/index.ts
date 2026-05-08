import NextAuth from 'next-auth';
import { authConfig } from './config';

// Type assertion to bypass @auth/core version mismatch between next-auth and @auth/drizzle-adapter
const nextAuth = NextAuth(authConfig as any);

export const { handlers, signIn, signOut } = nextAuth;

const realAuth = nextAuth.auth;

/**
 * Server-side session resolver.
 *
 * Test bypass: when E2E_TEST_USER_ID is set, every server-side `auth()` call
 * returns a synthetic session for that user — no OAuth dance, no cookies.
 * This lets Playwright drive authenticated flows deterministically against a
 * known DB user. The variable should NEVER be set in production; the bypass
 * is gated only by env, so make sure your deployment env doesn't carry it.
 *
 * The synthetic session deliberately omits `image` and uses a placeholder
 * email so it's obvious in any logged output that this is a test session.
 */
export const auth = (async (...args: any[]) => {
  if (process.env.E2E_TEST_USER_ID) {
    return {
      user: {
        id: process.env.E2E_TEST_USER_ID,
        email: process.env.E2E_TEST_USER_EMAIL || 'e2e-test@example.com',
        name: process.env.E2E_TEST_USER_NAME || 'E2E Test User',
        role: (process.env.E2E_TEST_USER_ROLE as 'user' | 'admin') || 'user',
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  return (realAuth as any)(...args);
}) as typeof realAuth;
