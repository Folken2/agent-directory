import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-14rem)] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-label-large text-md-on-surface-variant">404</p>
      <h1 className="mt-2 text-headline-small tracking-tight text-md-on-surface">Page not found</h1>
      <p className="mt-2 text-body-large text-md-on-surface-variant">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonVariants({ variant: 'filled' })}>
          Build an agent
        </Link>
        <Link href="/examples" className={buttonVariants({ variant: 'outlined' })}>
          Browse examples
        </Link>
      </div>
    </div>
  );
}
