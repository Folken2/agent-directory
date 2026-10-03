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
      <Card variant="elevated" className="mx-auto max-w-2xl rounded-[var(--md-shape-xl)] p-5">
        <p className="text-title-medium text-md-on-surface mb-1">Cookies & analytics</p>
        <p className="text-body-small text-md-on-surface-variant mb-4 leading-relaxed">
          We always count anonymous page visits (no persistent ID) so the directory
          stays useful. Optional analytics — a visitor cookie, time in agents, and
          Google Analytics if configured — only run if you accept.{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-md-on-surface">
            Privacy
          </Link>
        </p>
        <div className="flex flex-wrap items-center gap-2 justify-end">
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
