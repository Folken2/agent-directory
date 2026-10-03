import { Page, PageHeader } from '@/components/layout/Page';

/** Reading pages (About, Privacy): the shared page header over a text column. */
export function ProsePage({
  title,
  lead,
  children,
  after,
}: {
  title: string;
  lead: string;
  children: React.ReactNode;
  /** Full-width content after the text column, e.g. a call to action. */
  after?: React.ReactNode;
}) {
  return (
    <Page>
      <PageHeader title={title} description={lead} />
      <article className="max-w-3xl space-y-12 text-body-large text-md-on-surface-variant">{children}</article>
      {after}
    </Page>
  );
}

export function ProseSection({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 className="text-headline-small tracking-tight text-md-on-surface">{title}</h2>
      {children}
    </section>
  );
}

export const proseLink =
  'text-md-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary rounded-sm';
