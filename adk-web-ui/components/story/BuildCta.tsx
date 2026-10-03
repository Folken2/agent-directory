import { cn } from '@/lib/utils';
import { panelClass } from '@/components/ui/card';
import BuilderHero from '@/components/home/BuilderHero';

/**
 * End-of-page next step: every page closes by handing off to the builder,
 * with the composer right there instead of a link to it.
 */
export default function BuildCta({
  title = 'Have an agent in mind?',
  body = 'Describe it and the agent builder will design it with you.',
  children,
  className,
}: {
  title?: string;
  body?: string;
  /** Replaces the composer, e.g. with a prefilled link. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-label="Build your own agent" className={cn(panelClass, 'mt-20 px-6 py-10 sm:px-10 sm:py-12', className)}>
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-md">
          <h2 className="text-headline-small tracking-tight text-md-on-surface">{title}</h2>
          <p className="mt-2 text-body-large text-md-on-surface-variant">{body}</p>
        </div>
        {children ? (
          <div className="shrink-0">{children}</div>
        ) : (
          <div className="w-full lg:max-w-xl">
            <BuilderHero compact label="Describe the agent you want to build" placeholder="Describe your agent…" />
          </div>
        )}
      </div>
    </section>
  );
}
