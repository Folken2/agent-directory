'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SubAgentStep } from '@/lib/types';

interface SubAgentProgressProps {
  steps: SubAgentStep[];
  /** When true, the most recent running step pulses to draw attention. */
  isStreaming?: boolean;
}

function titleCase(name: string): string {
  return name
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function StepRow({ step, isLast, streamingNow }: { step: SubAgentStep; isLast: boolean; streamingNow: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const running = step.status === 'running';
  const label = titleCase(step.author);
  const showRunIndex = step.runIndex > 1;

  return (
    <div className="border-t border-md-outline-variant/30 first:border-t-0">
      <button
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors',
          'hover:bg-md-surface-container/50',
          running && streamingNow && 'bg-md-primary/5',
        )}
      >
        <span className="flex h-4 w-4 items-center justify-center">
          {running ? (
            <Loader2
              className={cn(
                'h-3.5 w-3.5 text-md-on-surface-variant',
                streamingNow && 'animate-spin text-md-primary',
              )}
            />
          ) : (
            <Check className="h-3.5 w-3.5 text-md-primary" />
          )}
        </span>
        <span className="flex-1 text-[13px] text-md-on-surface">
          {label}
          {showRunIndex && (
            <span className="ml-1.5 text-md-on-surface-variant/60">· run {step.runIndex}</span>
          )}
        </span>
        <span className="text-label-small uppercase tracking-widest text-md-on-surface-variant/60">
          {running ? 'Working' : 'Done'}
        </span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-md-on-surface-variant/70" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-md-on-surface-variant/70" />
        )}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mx-4 mb-3 max-h-72 overflow-y-auto rounded-lg border border-md-outline-variant/30 bg-md-surface-container/40 px-4 py-3 text-[12px] leading-relaxed text-md-on-surface-variant whitespace-pre-wrap font-mono">
              {step.content || (running ? 'Waiting for first output…' : '(no content)')}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SubAgentProgress({ steps, isStreaming = false }: SubAgentProgressProps) {
  if (steps.length === 0) return null;

  // The "active" step is the last running one (if any) — that's what should pulse.
  const activeIdx = (() => {
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i].status === 'running') return i;
    }
    return -1;
  })();

  const doneCount = steps.filter((s) => s.status === 'done').length;
  const totalLabel = isStreaming ? `${doneCount}/${steps.length} steps` : `${steps.length} steps`;

  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-md-outline-variant/40 bg-md-surface-container-low/60">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-md-outline-variant/30">
        <span className="text-label-small uppercase tracking-widest text-md-on-surface-variant/70">
          Research progress
        </span>
        <span className="ml-auto text-label-small uppercase tracking-widest text-md-on-surface-variant/50 tabular-nums">
          {totalLabel}
        </span>
      </div>
      <div>
        {steps.map((step, i) => (
          <StepRow
            key={`${step.author}-${step.runIndex}`}
            step={step}
            isLast={i === steps.length - 1}
            streamingNow={isStreaming && i === activeIdx}
          />
        ))}
      </div>
    </div>
  );
}
