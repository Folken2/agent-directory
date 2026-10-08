'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, RotateCcw, Send, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarkdownRenderer } from '@/components/chat/markdown';
import { adkClient } from '@/lib/adk-client';
import { ChatApiError } from '@/lib/api-error';
import { StreamAssembler } from '@/lib/chat/stream-assembler';
import { useDarkMode } from '@/lib/hooks/useDarkMode';
import { MAX_PREVIEW_TEXT, type PreviewState } from '@/lib/preview/types';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

type PreviewMessage = { id: string; role: 'user' | 'agent'; text: string };

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Chat with the agent the builder is building, running live in its sandbox.
 * Messages go through /api/preview; the panel never knows where the preview
 * runs. Key it on the builder session and `startedAt`, so a restarted
 * preview gets a fresh conversation.
 */
export default function PreviewPanel({
  sessionId,
  state,
  onClose,
  className,
}: {
  sessionId: string;
  state: PreviewState;
  onClose?: () => void;
  className?: string;
}) {
  const isDarkMode = useDarkMode();
  const setBuilderPreview = useAppStore((s) => s.setBuilderPreview);
  const [previewSessionId, setPreviewSessionId] = useState(newId);
  const [messages, setMessages] = useState<PreviewMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState('');
  const [tools, setTools] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const running = state.status === 'running';

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setPreviewSessionId(newId());
    setMessages([]);
    setStreaming('');
    setTools([]);
    setError(null);
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, streaming]);

  const markStopped = useCallback(() => {
    setBuilderPreview({ sessionId, state: { ...state, status: 'stopped' } });
  }, [sessionId, state, setBuilderPreview]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || busy || !running) return;
    setDraft('');
    setError(null);
    setBusy(true);
    setTools([]);
    setMessages((m) => [...m, { id: newId(), role: 'user', text }]);

    const controller = new AbortController();
    controllerRef.current = controller;
    // No finalSubAgent: every author's text counts as the agent's reply.
    const assembler = new StreamAssembler({ name: state.package ?? '' });
    try {
      for await (const chunk of adkClient.streamPreview(sessionId, previewSessionId, text, controller.signal)) {
        const update = assembler.apply(chunk);
        if (update.content !== undefined) setStreaming(update.content);
        if (update.toolCallName) setTools((t) => [...t, update.toolCallName as string]);
        if (update.error) setError(update.error.message);
      }
      const reply = assembler.finalize({ includeExtras: false }).content;
      if (reply) setMessages((m) => [...m, { id: newId(), role: 'agent', text: reply }]);
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(e instanceof ChatApiError ? e.message : 'The preview could not be reached.');
        if (e instanceof ChatApiError && e.code === 'not_found') markStopped();
      }
    } finally {
      setStreaming('');
      setBusy(false);
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, [draft, busy, running, state.package, sessionId, previewSessionId, markStopped]);

  const stop = useCallback(async () => {
    controllerRef.current?.abort();
    try {
      await fetch(`/api/preview?session_id=${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
    } finally {
      markStopped();
    }
  }, [sessionId, markStopped]);

  return (
    <section
      aria-label="Agent preview"
      className={cn('flex h-full min-h-0 flex-col bg-md-surface text-md-on-surface', className)}
    >
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-md-outline/40 px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">Preview{state.project ? ` · ${state.project}` : ''}</p>
          <p className="flex items-center gap-1.5 text-xs text-md-on-surface-variant">
            <span
              aria-hidden
              className={cn('size-2 rounded-full', running ? 'bg-emerald-500' : 'bg-md-on-surface-variant/50')}
            />
            {running ? 'Running in a sandbox' : 'Stopped'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="text" size="sm" onClick={reset} disabled={busy || messages.length === 0} aria-label="New preview conversation">
            <RotateCcw /> New
          </Button>
          {running && (
            <Button variant="text" size="sm" onClick={stop} aria-label="Stop the preview">
              <Square /> Stop
            </Button>
          )}
          {onClose && (
            <Button variant={null} size="icon" onClick={onClose} aria-label="Close preview">
              <X />
            </Button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !streaming && (
          <p className="text-sm text-md-on-surface-variant">
            {running
              ? 'Talk to your agent. It runs the code the builder wrote, with a small model budget.'
              : 'The preview is stopped. Ask the builder to start it again.'}
          </p>
        )}
        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="ml-auto w-fit max-w-[85%] rounded-2xl bg-md-primary-container px-3.5 py-2 text-sm text-md-on-primary-container">
              {m.text}
            </div>
          ) : (
            <MarkdownRenderer key={m.id} content={m.text} isStreaming={false} isDarkMode={isDarkMode} />
          )
        )}
        {busy && (
          <div className="space-y-2">
            {tools.length > 0 && (
              <p className="text-xs text-md-on-surface-variant">Used {tools.join(', ')}</p>
            )}
            {streaming ? (
              <MarkdownRenderer content={streaming} isStreaming isDarkMode={isDarkMode} />
            ) : (
              <Loader2 className="size-4 animate-spin text-md-on-surface-variant" aria-label="Waiting for the agent" />
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-md-error/10 px-3 py-2 text-sm text-md-error">
            {error}
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="flex shrink-0 items-end gap-2 border-t border-md-outline/40 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          maxLength={MAX_PREVIEW_TEXT}
          disabled={!running}
          placeholder={running ? 'Message your agent…' : 'Preview stopped'}
          aria-label="Message your agent"
          className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl bg-md-surface-container-high px-4 py-2.5 text-sm outline-none placeholder:text-md-on-surface-variant focus-visible:ring-2 focus-visible:ring-md-primary disabled:opacity-50"
        />
        <Button type="submit" size="icon" variant="filled" className="text-md-on-primary hover:bg-md-primary/92" disabled={!running || busy || !draft.trim()} aria-label="Send">
          <Send />
        </Button>
      </form>
    </section>
  );
}
