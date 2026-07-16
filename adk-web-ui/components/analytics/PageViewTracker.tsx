'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

/**
 * Client beacon for App Router soft navigations (RSC fetches are ignored by middleware).
 * Server middleware covers full document loads + most bots.
 */
export default function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;

    const query = searchParams?.toString() || '';
    const key = `${pathname}?${query}`;
    if (lastKey.current === key) return;
    lastKey.current = key;

    const body = JSON.stringify({
      path: pathname,
      query: query ? `?${query}` : null,
      referrer: typeof document !== 'undefined' ? document.referrer || null : null,
      source: 'client',
      userId: session?.user?.id ?? null,
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
  }, [pathname, searchParams, session?.user?.id]);

  return null;
}
