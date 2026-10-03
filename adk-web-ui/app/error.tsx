'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ui] route error', error.digest ?? '', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">This page hit an unexpected error. You can try again or go back home.</p>
      <div className="flex gap-3">
        <button type="button" onClick={reset} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">
          Try again
        </button>
        <Link href="/" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          Home
        </Link>
      </div>
    </main>
  );
}
