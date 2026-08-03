'use client';

import {
  CONSENT_COOKIE_NAME,
  type ConsentLevel,
  parseConsent,
  hasAnalyticsConsent,
} from '@/lib/analytics/consent';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(name.length + 1));
}

export function readClientConsent(): ConsentLevel | null {
  return parseConsent(readCookie(CONSENT_COOKIE_NAME));
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function applyGtagConsent(level: ConsentLevel): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  const granted = hasAnalyticsConsent(level);
  window.gtag('consent', 'update', {
    ad_storage: granted ? 'granted' : 'denied',
    ad_user_data: granted ? 'granted' : 'denied',
    ad_personalization: granted ? 'granted' : 'denied',
    analytics_storage: granted ? 'granted' : 'denied',
  });
}

/**
 * Persist consent via API (sets/clears httpOnly ad_vid) and update gtag.
 */
export async function setClientConsent(level: ConsentLevel): Promise<void> {
  try {
    await fetch('/api/analytics/consent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ level }),
    });
  } catch {
    // analytics must never break UX
  }
  applyGtagConsent(level);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ad-consent-change', { detail: level }));
  }
}
