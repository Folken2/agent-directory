'use client';

import { readClientConsent } from '@/lib/analytics/consent-client';
import { hasAnalyticsConsent } from '@/lib/analytics/consent';
import type { EngagementEventType } from '@/lib/analytics/record-engagement';

type EngagementPayload = {
  eventType: EngagementEventType;
  agentSlug?: string | null;
  path?: string;
  sessionKey?: string | null;
  durationMs?: number | null;
  metadata?: Record<string, unknown> | null;
};

/** Fire-and-forget engagement beacon — no-ops without analytics consent. */
export function trackEngagement(payload: EngagementPayload): void {
  if (typeof window === 'undefined') return;
  if (!hasAnalyticsConsent(readClientConsent())) return;

  const body = JSON.stringify({
    ...payload,
    path: payload.path || window.location.pathname,
  });

  try {
    if (typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon('/api/analytics/engagement', blob)) return;
    }
  } catch {
    // fall through
  }

  void fetch('/api/analytics/engagement', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
}

export function trackGtagEvent(
  name: string,
  params?: Record<string, string | number | boolean | undefined>
): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  if (!hasAnalyticsConsent(readClientConsent())) return;
  window.gtag('event', name, params);
}
