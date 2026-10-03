import { cn } from '@/lib/utils';
import { panelClass } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** The dashboard's frame while the first stats load: tiles, chart, two lists. */
export default function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading analytics">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn(panelClass, 'space-y-3 p-4 sm:p-5', i === 0 && 'col-span-2 lg:col-span-1')}>
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3.5 w-32" />
          </div>
        ))}
      </div>
      <div className={cn(panelClass, 'space-y-4 p-5 sm:p-6')}>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-64 w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className={cn(panelClass, 'space-y-4 p-5 sm:p-6')}>
            <Skeleton className="h-4 w-28" />
            {[0, 1, 2, 3, 4].map((j) => (
              <div key={j} className="space-y-2">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-1.5" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
