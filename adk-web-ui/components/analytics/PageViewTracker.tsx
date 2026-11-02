'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { hasAnalyticsConsent } from '@/lib/analytics/consent';
import { readClientConsent } from '@/lib/analytics/consent-client';
import { pageviewBeacon } from '@/lib/analytics/pageview-beacon';
import { noteVisitPage } from '@/lib/analytics/visit-context';

/**
 * Client beacon for App Router soft navigations (RSC fetches are ignored by middleware).
 * Server middleware covers full document loads + most bots, so the first
 * render after a load is skipped. User id, IP and geo are derived on the server.
 */
export default function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;

    noteVisitPage(pathname, hasAnalyticsConsent(readClientConsent()));

    const query = searchParams?.toString() || '';
    const previous = lastKey.current;
    const { send, nextKey } = pageviewBeacon(previous, `${pathname}?${query}`);
    lastKey.current = nextKey;
    if (!send || previous === null) return;

    const body = JSON.stringify({
      path: pathname,
      query: query ? `?${query}` : null,
      // A soft navigation comes from our previous page, not document.referrer
      // (that still names the site that started the visit).
      referrer: `${window.location.origin}${previous.replace(/\?$/, '')}`,
      language:
        typeof navigator !== 'undefined' ? navigator.language || null : null,
    });

    const url = '/api/analytics/pageview';

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([body], { type: 'application/json' });
        const sent = navigator.sendBeacon(url, blob);
        if (sent) return;
      }
    } catch {
      // fall through to fetch
    }

    void fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // analytics must never break UX
    });
  }, [pathname, searchParams]);

  return null;
}
