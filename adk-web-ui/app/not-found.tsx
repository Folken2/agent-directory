import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">That page doesn&apos;t exist. Browse the agents instead.</p>
      <Link href="/" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
        Browse agents
      </Link>
    </main>
  );
}
