import { Skeleton } from '@/components/ui/skeleton';

/** The chat workspace's frame while the page boots: sidebar, top bar, composer. */
export default function ChatSkeleton() {
  return (
    <div role="status" aria-label="Loading chat" className="flex h-dvh overflow-hidden bg-md-surface-container-low">
      <div className="hidden w-60 shrink-0 flex-col gap-4 border-r border-md-outline/40 p-4 md:flex">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="mt-4 h-4 w-40" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-md-outline/40 px-4">
          <Skeleton className="size-8" />
          <Skeleton className="h-5 w-44" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
          <Skeleton className="size-11 rounded-2xl" />
          <Skeleton className="h-7 w-64 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="px-4 pb-6">
          <Skeleton className="mx-auto h-24 w-full max-w-3xl rounded-[var(--md-shape-xl)]" />
        </div>
      </div>
    </div>
  );
}
