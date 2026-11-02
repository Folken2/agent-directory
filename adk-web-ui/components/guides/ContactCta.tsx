import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

/** Closing hand-off from a guide to /contact, for readers who want help shipping it. */
export default function ContactCta({ className }: { className?: string }) {
  return (
    <section
      aria-label="Get help"
      className={cn(
        'mt-12 flex flex-col gap-4 border-t border-md-outline/60 pt-8 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="max-w-xl">
        <h2 className="text-title-large text-md-on-surface">Want this in production?</h2>
        <p className="mt-1 text-body-medium text-md-on-surface-variant">
          I help teams design ADK agents and take them to production: MCP integrations, evaluation, deployment and
          guardrails.
        </p>
      </div>
      <Link
        href="/contact"
        data-ga-event="contact_click"
        className={cn(buttonVariants({ variant: 'outlined' }), 'shrink-0')}
      >
        Talk to me
        <ArrowRight />
      </Link>
    </section>
  );
}
