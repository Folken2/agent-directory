'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import './globals.css';

/** Last-resort page when the root layout itself fails: same look, no app shell. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[ui] global error', error.digest ?? '', error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-md-surface-container-low text-md-on-surface antialiased">
        <main className="mx-auto flex min-h-dvh max-w-7xl flex-col justify-center px-4 py-16 sm:px-6 lg:px-8">
          {/* eslint-disable-next-line @next/next/no-img-element -- the app shell (and next/image) may be what failed */}
          <img src="/adk-logo.png" alt="" width={40} height={40} />
          <h1 className="mt-8 text-display-small tracking-tight">Something went wrong</h1>
          <p className="mt-3 max-w-2xl text-body-large text-md-on-surface-variant">
            Agent Directory couldn&apos;t load. Try again, or reload the page in a moment.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-10 items-center rounded-full bg-md-primary px-6 text-sm font-medium text-md-on-primary"
            >
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full reload is the point here */}
            <a href="/" className="inline-flex h-10 items-center rounded-full border border-md-on-surface-variant/50 px-6 text-sm font-medium text-md-primary">
              Reload home
            </a>
          </div>
          {error.digest ? (
            <p className="mt-8 text-body-small text-md-on-surface-variant">
              Reference: <code className="font-mono">{error.digest}</code>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
