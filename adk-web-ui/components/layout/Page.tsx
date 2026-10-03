import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Page grammar shared by every page except chat: one container whose left
 * edge lines up with the logo, one header, one section rhythm.
 */
export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-7xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12 lg:px-8', className)}>{children}</div>;
}

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1 text-label-large text-md-on-surface-variant">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1">
            {i > 0 ? <ChevronRight className="size-4 opacity-60" aria-hidden /> : null}
            {item.href ? (
              <Link
                href={item.href}
                className="rounded-sm transition-colors hover:text-md-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-md-on-surface">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  leading,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: Crumb[];
  /** Shown before the title, e.g. an agent logo. */
  leading?: React.ReactNode;
}) {
  return (
    <header className="mb-10">
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {leading}
          <div className="min-w-0 max-w-3xl">
            <h1 className="text-headline-large tracking-tight text-md-on-surface sm:text-display-small">{title}</h1>
            {description ? <div className="mt-3 text-body-large text-md-on-surface-variant">{description}</div> : null}
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Section({
  title,
  description,
  action,
  children,
  className,
  id,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  // Always name the region after its heading so it is announced as a landmark.
  const headingId = `${id ?? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-heading`;
  return (
    <section id={id} aria-labelledby={headingId} className={cn('mt-16 [header+&]:mt-0', className)}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 id={headingId} className="text-headline-small tracking-tight text-md-on-surface">
            {title}
          </h2>
          {description ? <p className="mt-1 text-body-medium text-md-on-surface-variant">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
