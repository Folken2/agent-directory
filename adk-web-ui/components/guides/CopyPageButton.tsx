'use client';

import { useState } from 'react';
import { Check, Copy, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { trackGtagEvent } from '@/lib/analytics/track-engagement';

/**
 * Copies the guide as Markdown, for pasting into a coding agent. The text is
 * passed in rather than fetched on click: Safari drops clipboard writes that
 * happen after an await.
 */
export default function CopyPageButton({
  markdown,
  slug,
  markdownHref,
}: {
  markdown: string;
  slug: string;
  markdownHref: string;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setState('copied');
      trackGtagEvent('copy_page', { guide_slug: slug });
    } catch {
      setState('failed');
    }
    setTimeout(() => setState('idle'), 2000);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <button type="button" onClick={copy} className={buttonVariants({ variant: 'outlined', size: 'sm' })}>
        {state === 'copied' ? <Check aria-hidden /> : <Copy aria-hidden />}
        {state === 'copied' ? 'Copied' : state === 'failed' ? "Couldn't copy" : 'Copy page'}
      </button>
      <a
        href={markdownHref}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-sm text-label-large text-md-on-surface-variant transition-colors',
          'hover:text-md-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary'
        )}
      >
        <FileText className="size-4" aria-hidden />
        View as Markdown
      </a>
      <span role="status" aria-live="polite" className="sr-only">
        {state === 'copied' ? 'Page copied as Markdown' : ''}
      </span>
    </div>
  );
}
