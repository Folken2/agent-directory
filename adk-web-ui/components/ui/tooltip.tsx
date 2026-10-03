'use client';

import * as T from '@radix-ui/react-tooltip';

export const TooltipProvider = T.Provider;

export function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  return (
    <T.Root delayDuration={300}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content sideOffset={6} className="z-[80] rounded-[4px] bg-md-on-surface px-2 py-1 text-xs text-md-surface">
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
