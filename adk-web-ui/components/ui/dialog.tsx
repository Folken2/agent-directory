'use client';

import * as React from 'react';
import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
}: { title: string; description?: string; children?: React.ReactNode; className?: string }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-[70] bg-black/32 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <D.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-[71] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2',
          'rounded-[var(--md-shape-xl)] bg-md-surface-container-high p-6 text-md-on-surface shadow-elevation-3',
          'focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className
        )}
      >
        <D.Title className="text-2xl font-normal leading-8">{title}</D.Title>
        {description ? (
          <D.Description className="mt-4 text-sm text-md-on-surface-variant">{description}</D.Description>
        ) : (
          <D.Description className="sr-only">{title}</D.Description>
        )}
        <div className="mt-4">{children}</div>
        <D.Close
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full text-md-on-surface-variant hover:bg-md-on-surface/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
        >
          <X className="h-5 w-5" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}

export function DialogFooter({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-6 flex justify-end gap-2', className)} {...p} />;
}
