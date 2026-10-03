'use client';

import * as React from 'react';
import * as M from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;

export function DropdownMenuContent({ className, align = 'end', sideOffset = 6, ...p }: M.DropdownMenuContentProps) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-[60] min-w-[200px] overflow-hidden rounded-[var(--md-shape-sm)] bg-md-surface-container py-2 text-md-on-surface shadow-elevation-2',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className
        )}
        {...p}
      />
    </M.Portal>
  );
}

export function DropdownMenuItem({ className, ...p }: M.DropdownMenuItemProps) {
  return (
    <M.Item
      className={cn(
        'flex h-12 cursor-pointer select-none items-center gap-3 px-3 text-sm outline-none',
        'data-[highlighted]:bg-md-on-surface/8 data-[disabled]:pointer-events-none data-[disabled]:opacity-40 [&_svg]:size-5 [&_svg]:text-md-on-surface-variant',
        className
      )}
      {...p}
    />
  );
}

export function DropdownMenuLabel({ className, ...p }: M.DropdownMenuLabelProps) {
  return <M.Label className={cn('px-3 py-2 text-xs text-md-on-surface-variant', className)} {...p} />;
}

export function DropdownMenuSeparator({ className, ...p }: M.DropdownMenuSeparatorProps) {
  return <M.Separator className={cn('my-2 h-px bg-md-outline-variant', className)} {...p} />;
}

export const DropdownMenuRadioGroup = M.RadioGroup;

export function DropdownMenuRadioItem({ className, children, ...p }: M.DropdownMenuRadioItemProps) {
  return (
    <M.RadioItem
      className={cn(
        'flex min-h-12 cursor-pointer select-none items-center gap-3 px-3 py-2 text-sm outline-none',
        'data-[highlighted]:bg-md-on-surface/8 data-[state=checked]:bg-md-secondary-container data-[state=checked]:text-md-on-secondary-container',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-40 [&_svg]:size-5 [&_svg]:text-md-on-surface-variant',
        className
      )}
      {...p}
    >
      {children}
      <M.ItemIndicator className="ml-auto">
        <Check aria-hidden />
      </M.ItemIndicator>
    </M.RadioItem>
  );
}
