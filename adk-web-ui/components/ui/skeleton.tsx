import { cn } from '@/lib/utils';

/** Placeholder block for loading states. Pulses only when motion is allowed. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('rounded-[var(--md-shape-sm)] bg-md-on-surface/8 motion-safe:animate-pulse', className)} />;
}
