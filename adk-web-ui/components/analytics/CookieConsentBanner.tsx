'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  readClientConsent,
  setClientConsent,
} from '@/lib/analytics/consent-client';
import type { ConsentLevel } from '@/lib/analytics/consent';

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
      <div className="mx-auto max-w-2xl rounded-2xl border border-md-outline bg-md-surface-container elevation-3 px-5 py-4 sm:px-6 sm:py-5 shadow-lg">
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
          <button
            type="button"
            onClick={() => void choose('essential')}
            className="rounded-lg border border-md-outline px-3.5 py-2 text-label-large text-md-on-surface-variant hover:border-md-outline hover:text-md-on-surface transition-colors"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => void choose('all')}
            className="rounded-lg bg-md-primary px-3.5 py-2 text-label-large text-md-on-primary hover:opacity-90 transition-opacity"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
