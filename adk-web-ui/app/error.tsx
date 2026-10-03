'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button, buttonVariants } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ui] route error', error.digest ?? '', error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-headline-small text-md-on-surface">Something went wrong</h1>
      <p className="text-body-large text-md-on-surface-variant">
        This page hit an unexpected error. You can try again or go back home.
      </p>
      <div className="flex gap-3">
        <Button variant="outlined" onClick={reset}>
          Try again
        </Button>
        <Link href="/" className={buttonVariants({ variant: 'filled' })}>
          Home
        </Link>
      </div>
    </div>
  );
}
