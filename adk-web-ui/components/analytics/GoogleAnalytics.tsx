'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { isPrivatePath } from '@/lib/analytics/should-track';
import { readClientConsent, applyGtagConsent } from '@/lib/analytics/consent-client';
import { isFunnelEvent } from '@/lib/analytics/engagement-input';
import { trackFunnelEvent, trackGtagEvent } from '@/lib/analytics/track-engagement';

const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * Optional GA4. Loads only when NEXT_PUBLIC_GA_MEASUREMENT_ID is set.
 * Consent Mode defaults to denied; updates when the user Accepts.
 */
export default function GoogleAnalytics() {
  const pathname = usePathname();
  // Build links carry a secret token; gtag would send the full URL to Google.
  const isPrivate = isPrivatePath(pathname);
  useEffect(() => {
    if (!MEASUREMENT_ID || isPrivate) return;
    const sync = () => {
      const level = readClientConsent();
      if (level) applyGtagConsent(level);
    };
    sync();
    window.addEventListener('ad-consent-change', sync);
    return () => window.removeEventListener('ad-consent-change', sync);
  }, [isPrivate]);

  // Server-rendered links can't take onClick, so they opt in with
  // data-ga-event="name" (+ optional data-ga-agent) and one listener reports
  // them: to GA4 when loaded, and funnel steps to first-party analytics always.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest<HTMLElement>('[data-ga-event]');
      const name = target?.dataset.gaEvent;
      if (!name) return;
      const params = { agent_slug: target.dataset.gaAgent };
      if (isFunnelEvent(name)) trackFunnelEvent(name, params);
      else trackGtagEvent(name, params);
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  if (!MEASUREMENT_ID || isPrivate) return null;

  return (
    <>
      <Script id="ga-consent-default" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('consent', 'default', {
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            analytics_storage: 'denied',
            wait_for_update: 500
          });
        `}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-config" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${MEASUREMENT_ID}', { anonymize_ip: true });
        `}
      </Script>
    </>
  );
}
