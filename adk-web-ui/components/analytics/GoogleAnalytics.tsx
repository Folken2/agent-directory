'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { readClientConsent, applyGtagConsent } from '@/lib/analytics/consent-client';
import { hasAnalyticsConsent } from '@/lib/analytics/consent';

const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * Optional GA4. Loads only when NEXT_PUBLIC_GA_MEASUREMENT_ID is set.
 * Consent Mode defaults to denied; updates when the user Accepts.
 */
export default function GoogleAnalytics() {
  useEffect(() => {
    if (!MEASUREMENT_ID) return;
    const sync = () => {
      const level = readClientConsent();
      if (level) applyGtagConsent(level);
    };
    sync();
    window.addEventListener('ad-consent-change', sync);
    return () => window.removeEventListener('ad-consent-change', sync);
  }, []);

  if (!MEASUREMENT_ID) return null;

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

/** Vercel Analytics only after Accept. */
export function ConsentGatedVercelAnalytics() {
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const sync = () => setOk(hasAnalyticsConsent(readClientConsent()));
    sync();
    window.addEventListener('ad-consent-change', sync);
    return () => window.removeEventListener('ad-consent-change', sync);
  }, []);

  if (!ok) return null;
  return <Analytics />;
}
