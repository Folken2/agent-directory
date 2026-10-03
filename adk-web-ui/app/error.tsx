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
    <div className="mx-auto flex min-h-[calc(100dvh-14rem)] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-headline-small tracking-tight text-md-on-surface">Something went wrong</h1>
      <p className="mt-2 text-body-large text-md-on-surface-variant">
        This page hit an unexpected error. Try again, or go back to the start.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button variant="filled" onClick={reset}>
          Try again
        </Button>
        <Link href="/" className={buttonVariants({ variant: 'outlined' })}>
          Go home
        </Link>
      </div>
    </div>
  );
}
