'use client';

import { readClientConsent } from '@/lib/analytics/consent-client';
import { hasAnalyticsConsent } from '@/lib/analytics/consent';
import { isConsentOnlyEvent, type EngagementEventType } from '@/lib/analytics/engagement-input';
import { currentVisit } from '@/lib/analytics/visit-context';

type EngagementPayload = {
  eventType: EngagementEventType;
  agentSlug?: string | null;
  path?: string;
  sessionKey?: string | null;
  durationMs?: number | null;
  metadata?: Record<string, string | number | boolean | undefined> | null;
};

/**
 * Fire-and-forget engagement beacon. Active-use events (messages, tool calls,
 * heartbeats) need analytics consent; funnel clicks are sent either way and
 * the server stores them without identifiers when consent is missing.
 */
export function trackEngagement(payload: EngagementPayload): void {
  if (typeof window === 'undefined') return;
  if (isConsentOnlyEvent(payload.eventType) && !hasAnalyticsConsent(readClientConsent())) return;

  const visit = currentVisit();
  const body = JSON.stringify({
    ...payload,
    path: payload.path || window.location.pathname,
    landing: visit?.landing ?? null,
    visit: visit?.key ?? null,
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

/**
 * A funnel step: reported to GA4 when it is loaded and always to the
 * first-party funnel, so `/analytics/ops` works without GA4.
 */
export function trackFunnelEvent(
  name: string,
  params: Record<string, string | number | boolean | undefined> = {}
): void {
  trackGtagEvent(name, params);
  const { agent_slug: agentSlug, ...rest } = params;
  trackEngagement({
    eventType: name,
    agentSlug: typeof agentSlug === 'string' ? agentSlug : null,
    metadata: Object.keys(rest).length ? rest : null,
  });
}
