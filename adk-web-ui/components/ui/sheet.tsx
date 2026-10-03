'use client';

import * as React from 'react';
import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Sheet = D.Root;
export const SheetTrigger = D.Trigger;
export const SheetClose = D.Close;

export function SheetContent({
  side = 'left',
  title,
  children,
  className,
}: { side?: 'left' | 'right'; title: string; children?: React.ReactNode; className?: string }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-[70] bg-black/32 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <D.Content
        className={cn(
          'fixed inset-y-0 z-[71] flex w-[min(320px,85vw)] flex-col bg-md-surface-container-low p-3 shadow-elevation-3 focus:outline-none',
          side === 'left'
            ? 'left-0 rounded-r-[var(--md-shape-lg)] data-[state=open]:animate-in data-[state=open]:slide-in-from-left'
            : 'right-0 rounded-l-[var(--md-shape-lg)] data-[state=open]:animate-in data-[state=open]:slide-in-from-right',
          className
        )}
      >
        <div className="flex items-center justify-between px-3 py-2">
          <D.Title className="text-sm font-medium text-md-on-surface-variant">{title}</D.Title>
          <D.Close aria-label="Close" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-md-on-surface-variant hover:bg-md-on-surface/8">
            <X className="h-5 w-5" />
          </D.Close>
        </div>
        <D.Description className="sr-only">{title}</D.Description>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </D.Content>
    </D.Portal>
  );
}
