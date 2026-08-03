/**
 * First-party analytics consent (`ad_consent`).
 * `essential` = cookieless aggregates only; `all` = ad_vid + engagement + GA/Vercel.
 */

export const CONSENT_COOKIE_NAME = 'ad_consent';
export const CONSENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export type ConsentLevel = 'essential' | 'all';

export function parseConsent(value: string | undefined | null): ConsentLevel | null {
  if (value === 'all' || value === 'essential') return value;
  return null;
}

/** True when optional analytics (visitor ID, engagement, GA) may run. */
export function hasAnalyticsConsent(level: ConsentLevel | null | undefined): boolean {
  return level === 'all';
}

export function consentCookieOptions(secure?: boolean) {
  const useSecure =
    typeof secure === 'boolean'
      ? secure
      : Boolean(
          process.env.NEXTAUTH_URL?.startsWith('https://') ||
            process.env.NEXT_PUBLIC_BASE_URL?.startsWith('https://')
        );

  return {
    // Must be readable by the client banner / GA bootstrap.
    httpOnly: false,
    secure: useSecure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: CONSENT_COOKIE_MAX_AGE,
  };
}
