'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  readClientConsent,
  setClientConsent,
} from '@/lib/analytics/consent-client';
import type { ConsentLevel } from '@/lib/analytics/consent';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readClientConsent() === null);
  }, []);

  const choose = async (level: ConsentLevel) => {
    setVisible(false);
    await setClientConsent(level);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-[60] p-4 sm:p-6"
    >
      <Card
        variant="elevated"
        className="mx-auto flex max-w-3xl flex-col gap-3 rounded-[var(--md-shape-lg)] p-4 sm:flex-row sm:items-center sm:gap-6 sm:pl-6"
      >
        <p className="flex-1 text-body-medium text-md-on-surface-variant">
          We count visits anonymously, without cookies. If you accept, we also set an analytics
          cookie and measure how agents are used, which may include Google Analytics.{' '}
          <Link href="/privacy" className="text-md-primary underline-offset-2 hover:underline">
            Privacy
          </Link>
        </p>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <Button variant="text" onClick={() => void choose('essential')}>
            Essential only
          </Button>
          <Button variant="filled" onClick={() => void choose('all')}>
            Accept
          </Button>
        </div>
      </Card>
    </div>
  );
}
