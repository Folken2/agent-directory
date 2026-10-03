import { cn } from '@/lib/utils';
import { panelClass } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function SignInLoading() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-12rem)] w-full max-w-5xl items-center px-4 py-12 sm:px-6">
      <div role="status" aria-label="Loading sign-in" className={cn(panelClass, 'grid w-full overflow-hidden md:grid-cols-[1.1fr_1fr]')}>
        <div className="space-y-6 p-8 sm:p-12">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-11 w-40" />
          <Skeleton className="h-5 w-64" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-4 pt-2">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3.5 w-full" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col justify-center gap-4 bg-md-surface-container-low p-8 sm:p-12 dark:bg-md-surface">
          <Skeleton className="h-11 w-full rounded-full" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
      </div>
    </div>
  );
}
