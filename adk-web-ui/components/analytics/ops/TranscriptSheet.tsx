'use client';

import { useEffect, useState } from 'react';
import * as D from '@radix-ui/react-dialog';
import { AlertTriangle, Wrench, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TranscriptEntry } from '@/lib/analytics/ops-types';
import { Skeleton } from '@/components/ui/skeleton';
import { agentName } from './InsightsView';

export type TranscriptTarget = { appName: string; sessionId: string } | null;

function time(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}

/** Read-only replay of one conversation, in the chat's own visual language. */
export default function TranscriptSheet({ target, onClose }: { target: TranscriptTarget; onClose: () => void }) {
  const key = target ? `${target.appName}/${target.sessionId}` : '';
  // Results are tagged with the conversation they belong to, so switching
  // conversations shows the skeleton instead of the previous transcript.
  const [result, setResult] = useState<{ key: string; entries: TranscriptEntry[] | null; error: boolean }>({
    key: '',
    entries: null,
    error: false,
  });

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    const params = new URLSearchParams({ app: target.appName, session: target.sessionId });
    fetch(`/api/analytics/ops/conversation?${params}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json) => {
        if (!cancelled) setResult({ key, entries: json.entries ?? [], error: false });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, entries: null, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [target, key]);

  const entries = result.key === key ? result.entries : null;
  const error = result.key === key && result.error;

  // Tool responses arrive as user-authored events; fold them into the call line.
  const visible = (entries ?? []).filter((e) => e.text || e.toolCalls.length > 0 || e.error);

  return (
    <D.Root open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[70] bg-black/32 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <D.Content className="fixed inset-y-0 right-0 z-[71] flex w-[min(680px,100vw)] flex-col bg-md-surface-container-low shadow-elevation-3 focus:outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right">
          <div className="flex items-start justify-between gap-4 border-b border-md-outline/60 px-5 py-4 dark:border-md-outline-variant">
            <div className="min-w-0">
              <D.Title className="truncate text-title-large text-md-on-surface">
                {target ? agentName(target.appName) : 'Conversation'}
              </D.Title>
              <D.Description className="truncate text-label-medium text-md-on-surface-variant">
                {target?.sessionId} · times in UTC
              </D.Description>
            </div>
            <D.Close
              aria-label="Close"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-md-on-surface-variant hover:bg-md-on-surface/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
            >
              <X className="size-5" />
            </D.Close>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6" aria-busy={entries === null && !error}>
            {error ? (
              <p className="text-body-medium text-md-on-surface-variant">Could not load this conversation.</p>
            ) : entries === null ? (
              <div className="space-y-4" aria-label="Loading conversation">
                <Skeleton className="ml-auto h-10 w-2/3 rounded-2xl" />
                <Skeleton className="h-24 w-5/6 rounded-2xl" />
                <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
              </div>
            ) : (
              visible.map((e, i) => {
                const isUser = e.author === 'user';
                return (
                  <div key={i} className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
                    <span className="text-label-medium text-md-on-surface-variant">
                      {isUser ? 'User' : e.author === target?.appName ? agentName(e.author) : e.author} · {time(e.at)}
                    </span>
                    {e.text ? (
                      <div
                        className={cn(
                          'max-w-[90%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed',
                          isUser ? 'bg-md-surface-container text-md-on-surface' : 'border border-md-outline/60 bg-md-surface text-md-on-surface dark:border-md-outline-variant dark:bg-md-surface-container'
                        )}
                      >
                        {e.text}
                      </div>
                    ) : null}
                    {e.toolCalls.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {e.toolCalls.map((t, j) => (
                          <span
                            key={j}
                            className="inline-flex items-center gap-1 rounded-full border border-md-outline/60 px-2 py-0.5 font-mono text-[12px] text-md-on-surface-variant"
                          >
                            <Wrench className="size-3" aria-hidden />
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {e.error ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-md-error-container px-2.5 py-0.5 text-label-medium text-md-on-error-container">
                        <AlertTriangle className="size-3.5" aria-hidden />
                        {e.error}
                      </span>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
