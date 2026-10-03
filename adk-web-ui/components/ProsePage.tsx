/** Single-column reading layout shared by About and Privacy. */
export function ProsePage({ title, lead, children }: { title: string; lead: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
      <h1 className="text-headline-large tracking-tight text-md-on-surface">{title}</h1>
      <p className="mt-3 text-body-large text-md-on-surface-variant">{lead}</p>
      <div className="mt-10 space-y-10 text-body-large text-md-on-surface-variant">{children}</div>
    </article>
  );
}

export function ProseSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-title-large tracking-tight text-md-on-surface">{title}</h2>
      {children}
    </section>
  );
}

export const proseLink =
  'text-md-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary rounded-sm';
