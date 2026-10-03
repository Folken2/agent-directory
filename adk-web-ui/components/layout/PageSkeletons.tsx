import { cn } from '@/lib/utils';
import { panelClass } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Matches PageHeader's footprint so content doesn't jump when it loads. */
export function PageHeaderSkeleton() {
  return (
    <div className="mb-10 space-y-4" aria-hidden>
      <Skeleton className="h-10 w-56 sm:h-11" />
      <Skeleton className="h-5 w-96 max-w-full" />
    </div>
  );
}

/** A panel of list rows, like settings and chat history. */
export function ListSkeleton({ rows = 4, withAvatar = false }: { rows?: number; withAvatar?: boolean }) {
  return (
    <div className={cn(panelClass, 'max-w-3xl divide-y divide-md-outline/60 dark:divide-md-outline-variant')} aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          {withAvatar ? <Skeleton className="size-9 shrink-0 rounded-[var(--md-shape-md)]" /> : null}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
