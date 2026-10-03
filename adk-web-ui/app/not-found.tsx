import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-headline-small text-md-on-surface">Page not found</h1>
      <p className="text-body-large text-md-on-surface-variant">
        That page doesn&apos;t exist. Browse the agents instead.
      </p>
      <Link href="/" className={buttonVariants({ variant: 'filled' })}>
        Browse agents
      </Link>
    </div>
  );
}
