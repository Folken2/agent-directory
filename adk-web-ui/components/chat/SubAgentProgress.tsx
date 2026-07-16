'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Check,
  Brain,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SubAgentStep, SubAgentTool } from '@/lib/types';
import { MarkdownRenderer } from './markdown';

interface SubAgentProgressProps {
  steps: SubAgentStep[];
  /** When true, the most recent running step auto-expands. */
  isStreaming?: boolean;
  isDarkMode?: boolean;
}

function titleCase(name: string): string {
  return name
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function argPreview(args?: Record<string, unknown>): string | null {
  if (!args) return null;
  const preferred = ['query', 'q', 'url', 'path', 'name', 'prompt', 'search_query', 'file'];
  for (const key of preferred) {
    const v = args[key];
    if (typeof v === 'string' && v.trim()) {
      const t = v.trim().replace(/\s+/g, ' ');
      return t.length > 48 ? `${t.slice(0, 47)}…` : t;
    }
  }
  for (const v of Object.values(args)) {
    if (typeof v === 'string' && v.trim()) {
      const t = v.trim().replace(/\s+/g, ' ');
      return t.length > 48 ? `${t.slice(0, 47)}…` : t;
    }
  }
  return null;
}

function NestedTool({ tool }: { tool: SubAgentTool }) {
  const [open, setOpen] = useState(false);
  const hasDetails = !!(tool.args && Object.keys(tool.args).length > 0) || tool.response !== undefined || !!tool.error;
  const isLive = tool.status === 'running' || tool.status === 'pending';
  const preview = isLive ? argPreview(tool.args) : null;

  return (
    <div>
      <button
        type="button"
        onClick={() => hasDetails && setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 py-0.5 text-left text-[11px]',
          hasDetails && 'hover:text-foreground cursor-pointer',
          tool.status === 'error' ? 'text-destructive/80' : 'text-muted-foreground',
        )}
      >
        {isLive ? (
          <Loader2 className="h-3 w-3 animate-spin shrink-0 opacity-80" />
        ) : tool.status === 'error' ? (
          <XCircle className="h-3 w-3 shrink-0" />
        ) : (
          <Check className="h-3 w-3 shrink-0 opacity-70" />
        )}
        <span className="truncate flex-1">
          {isLive ? (
            <>
              <span className="stream-shimmer">Running</span>{' '}
              <span className="text-foreground/85">{titleCase(tool.name)}</span>
              {preview && <span className="text-muted-foreground/65"> · {preview}</span>}
            </>
          ) : (
            titleCase(tool.name)
          )}
        </span>
      </button>
      <AnimatePresence>
        {open && hasDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="overflow-hidden"
          >
            <div className="ml-5 mb-1 space-y-1">
              {tool.args && Object.keys(tool.args).length > 0 && (
                <pre className="text-[10px] font-mono max-h-24 overflow-auto rounded bg-muted/30 border border-border/20 px-2 py-1.5 whitespace-pre-wrap text-muted-foreground">
                  {JSON.stringify(tool.args, null, 2)}
                </pre>
              )}
              {tool.response !== undefined && (
                <pre className="text-[10px] font-mono max-h-24 overflow-auto rounded bg-muted/30 border border-border/20 px-2 py-1.5 whitespace-pre-wrap text-muted-foreground">
                  {typeof tool.response === 'string'
                    ? tool.response
                    : JSON.stringify(tool.response, null, 2)}
                </pre>
              )}
              {tool.error && (
                <div className="text-[10px] text-destructive/90 px-0.5">{tool.error}</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NestedToolsHierarchy({ tools }: { tools: SubAgentTool[] }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const active = tools.filter((t) => t.status === 'running' || t.status === 'pending');
  const errors = tools.filter((t) => t.status === 'error');
  const completed = tools.filter((t) => t.status === 'completed');

  return (
    <div className="space-y-0.5">
      {active.map((tool) => (
        <NestedTool key={tool.id} tool={tool} />
      ))}
      {errors.map((tool) => (
        <NestedTool key={tool.id} tool={tool} />
      ))}
      {completed.length === 1 && <NestedTool tool={completed[0]} />}
      {completed.length > 1 && (
        <div>
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className="flex w-full items-center gap-2 py-0.5 text-left text-[11px] text-muted-foreground/75 hover:text-foreground"
          >
            <Check className="h-3 w-3 shrink-0 opacity-70" />
            <span className="flex-1">Ran {completed.length} tools</span>
            {historyOpen ? (
              <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />
            )}
          </button>
          <AnimatePresence>
            {historyOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="overflow-hidden"
              >
                <div className="ml-1 pl-3 border-l border-border/25 space-y-0.5">
                  {completed.map((tool) => (
                    <NestedTool key={tool.id} tool={tool} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function NestedThinking({ content, streaming }: { content: string; streaming: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 py-1 px-1 rounded text-left text-[11px] text-muted-foreground hover:bg-muted/40 hover:text-foreground"
      >
        <Brain className={cn('h-3 w-3 shrink-0', streaming && 'animate-pulse')} />
        <span className="flex-1">{streaming && !open ? 'Thinking…' : 'Thought process'}</span>
        {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="ml-5 mb-1 max-h-40 overflow-y-auto rounded-md border border-border/20 bg-muted/30 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StepRow({
  step,
  streamingNow,
  shouldAutoOpen,
  isDarkMode,
  isStreaming,
}: {
  step: SubAgentStep;
  streamingNow: boolean;
  /** Hint to auto-open this step. We never force-close from this flag. */
  shouldAutoOpen: boolean;
  isDarkMode: boolean;
  isStreaming: boolean;
}) {
  const [expanded, setExpanded] = useState(shouldAutoOpen || !isStreaming);
  const stepEndRef = useRef<HTMLDivElement>(null);
  const contentBoxRef = useRef<HTMLDivElement>(null);
  const running = step.status === 'running';
  const label = titleCase(step.author);
  const showRunIndex = step.runIndex > 1;
  const toolCount = step.tools?.length ?? 0;
  const hasBody = !!(step.thinking || toolCount > 0 || step.content);

  // Only auto-OPEN. Never force-close.
  // (Force-close was the bug: when the final author starts we mark every step
  // done → activeIdx=-1 → preferExpanded=false for all → everything collapsed.)
  useEffect(() => {
    if (!isStreaming || shouldAutoOpen) {
      setExpanded(true);
    }
  }, [shouldAutoOpen, isStreaming]);

  // Keep the live step's growing body in view (inner box + thread).
  useEffect(() => {
    if (!streamingNow || !expanded) return;
    const box = contentBoxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
    stepEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'nearest' });
  }, [step.content, step.thinking, step.tools, streamingNow, expanded]);

  const activityHint = [
    step.thinking ? 'thinking' : null,
    toolCount > 0 ? `${toolCount} tool${toolCount === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 py-1.5 px-1 rounded text-left transition-colors',
          'hover:bg-muted/40',
          running && streamingNow ? 'text-foreground/80' : 'text-muted-foreground',
        )}
      >
        <span className="flex h-3.5 w-3.5 items-center justify-center shrink-0">
          {running ? (
            <Loader2
              className={cn(
                'h-3 w-3 text-muted-foreground',
                streamingNow && 'animate-spin',
              )}
            />
          ) : (
            <Check className="h-3 w-3 text-muted-foreground/70" />
          )}
        </span>
        <span className="flex-1 min-w-0 truncate font-medium">
          {label}
          {showRunIndex && (
            <span className="ml-1.5 text-muted-foreground/60 font-normal">· run {step.runIndex}</span>
          )}
          {activityHint && !expanded && (
            <span className="ml-1.5 text-muted-foreground/50 font-normal">· {activityHint}</span>
          )}
        </span>
        <span className="text-[10px] text-muted-foreground/70 shrink-0">
          {running ? 'Working' : 'Done'}
        </span>
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="ml-2 pl-3 border-l border-border/30 space-y-0.5 pb-2 opacity-90">
              {step.thinking && (
                <NestedThinking content={step.thinking} streaming={running && streamingNow} />
              )}

              {step.tools && step.tools.length > 0 && (
                <NestedToolsHierarchy tools={step.tools} />
              )}

              {step.content ? (
                <div
                  ref={contentBoxRef}
                  className="mt-1 max-h-44 overflow-y-auto rounded-md border border-border/20 bg-muted/25 px-2.5 py-2"
                >
                  <MarkdownRenderer
                    content={step.content}
                    isStreaming={running && streamingNow}
                    isDarkMode={isDarkMode}
                    className="markdown-content-subagent"
                  />
                </div>
              ) : !hasBody && running ? (
                <p className="py-1 px-1 text-[11px] text-muted-foreground/70">Starting…</p>
              ) : null}
              <div ref={stepEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SubAgentProgress({
  steps,
  isStreaming = false,
  isDarkMode = false,
}: SubAgentProgressProps) {
  if (steps.length === 0) return null;

  const activeIdx = (() => {
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i].status === 'running') return i;
    }
    return -1;
  })();

  const doneCount = steps.filter((s) => s.status === 'done').length;
  const summary = isStreaming
    ? `Agents · ${doneCount}/${steps.length}`
    : `${steps.length} agent step${steps.length === 1 ? '' : 's'}`;

  return (
    <div className="rounded-lg bg-muted/15 border border-border/20 px-2.5 py-2">
      <div className="flex items-center gap-2 mb-1.5 px-0.5">
        <span className="text-[11px] text-muted-foreground/75">{summary}</span>
        {isStreaming && activeIdx >= 0 && (
          <span className="text-[11px] stream-shimmer">live</span>
        )}
      </div>
      <div className="space-y-1">
        {steps.map((step, i) => {
          // While streaming, nudge the live step open. If every step is already
          // done (final author writing) keep the last step as the open hint —
          // but StepRow never force-closes either way.
          const shouldAutoOpen =
            !isStreaming ||
            i === activeIdx ||
            (activeIdx < 0 && i === steps.length - 1);

          return (
            <StepRow
              key={`${step.author}-${step.runIndex}`}
              step={step}
              streamingNow={isStreaming && i === activeIdx}
              shouldAutoOpen={shouldAutoOpen}
              isDarkMode={isDarkMode}
              isStreaming={isStreaming}
            />
          );
        })}
      </div>
    </div>
  );
}
