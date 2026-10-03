'use client';

import { Toaster, toast } from 'sonner';

export const notify = toast;

export function Snackbar() {
  return (
    <Toaster
      position="bottom-center"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-[min(560px,calc(100vw-32px))] items-center justify-between gap-4 rounded-[var(--md-shape-sm)] bg-md-on-surface px-4 py-3 text-sm text-md-surface shadow-elevation-3',
          actionButton: 'font-medium text-md-primary-container',
        },
      }}
    />
  );
}
