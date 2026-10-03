'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[ui] global error', error.digest ?? '', error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0 }}>
        <div style={{ textAlign: 'center', padding: 16 }}>
          <h1>Something went wrong</h1>
          <p>Please reload the page.</p>
          <button type="button" onClick={reset} style={{ padding: '8px 16px' }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
