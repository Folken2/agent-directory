export const VISITOR_COOKIE_NAME = 'ad_vid';
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidVisitorId(value: string | undefined | null): boolean {
  return Boolean(value && UUID_RE.test(value));
}

/** Uses global crypto so this works in Edge middleware and Node. */
export function createVisitorId(): string {
  return crypto.randomUUID();
}

/**
 * Prefer explicit secure flag; otherwise enable Secure only for https base URLs
 * so local http://localhost e2e/dev still receives the cookie.
 */
export function visitorCookieOptions(secure?: boolean) {
  const useSecure =
    typeof secure === 'boolean'
      ? secure
      : Boolean(
          process.env.NEXTAUTH_URL?.startsWith('https://') ||
            process.env.NEXT_PUBLIC_BASE_URL?.startsWith('https://')
        );

  return {
    httpOnly: true,
    secure: useSecure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: VISITOR_COOKIE_MAX_AGE,
  };
}
