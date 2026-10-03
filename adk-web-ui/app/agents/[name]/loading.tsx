export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse space-y-4 px-4 py-8" aria-busy="true" aria-label="Loading agent">
      <div className="h-8 w-1/3 rounded bg-muted" />
      <div className="h-4 w-2/3 rounded bg-muted" />
      <div className="h-64 rounded bg-muted" />
    </div>
  );
}
