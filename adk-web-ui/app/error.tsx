'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button, buttonVariants } from '@/components/ui/button';
import { Page, PageHeader } from '@/components/layout/Page';

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
    <Page>
      <PageHeader
        title="Something went wrong"
        description="This page hit an unexpected error. Trying again usually works; if it doesn't, start over from the builder."
      />
      <div className="flex flex-wrap gap-3">
        <Button variant="filled" onClick={reset}>
          Try again
        </Button>
        <Link href="/" className={buttonVariants({ variant: 'outlined' })}>
          Go to the builder
        </Link>
      </div>
      {error.digest ? (
        <p className="mt-8 text-body-small text-md-on-surface-variant">
          Reference: <code className="font-mono">{error.digest}</code>
        </p>
      ) : null}
    </Page>
  );
}
