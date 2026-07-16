'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { ToolStatus } from '@/lib/types';
import { Loader2, Check, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

/** One-line preview of the most useful arg (Cursor-style status crumb). */
function argPreview(args?: Record<string, unknown>): string | null {
  if (!args) return null;
  const preferred = ['query', 'q', 'url', 'path', 'name', 'prompt', 'search_query', 'file'];
  for (const key of preferred) {
    const v = args[key];
    if (typeof v === 'string' && v.trim()) {
      const t = v.trim().replace(/\s+/g, ' ');
      return t.length > 64 ? `${t.slice(0, 63)}…` : t;
    }
  }
  for (const v of Object.values(args)) {
    if (typeof v === 'string' && v.trim()) {
      const t = v.trim().replace(/\s+/g, ' ');
      return t.length > 64 ? `${t.slice(0, 63)}…` : t;
    }
  }
  return null;
}

function friendlyName(name: string): string {
  return name.replace(/[_-]+/g, ' ');
}

function ToolDetails({ tool }: { tool: ToolStatus }) {
  return (
    <div className="pl-5 pr-1 pb-1 space-y-1">
      {tool.args && Object.keys(tool.args).length > 0 && (
        <pre className="text-[10px] bg-muted/30 p-1.5 rounded border border-border/20 overflow-x-auto font-mono text-muted-foreground max-h-24 overflow-y-auto whitespace-pre-wrap">
          {JSON.stringify(tool.args, null, 2)}
        </pre>
      )}
      {tool.response !== undefined && (
        <pre className="text-[10px] bg-muted/30 p-1.5 rounded border border-border/20 overflow-x-auto font-mono text-muted-foreground max-h-24 overflow-y-auto whitespace-pre-wrap">
          {typeof tool.response === 'string'
            ? tool.response
            : JSON.stringify(tool.response, null, 2)}
        </pre>
      )}
      {tool.error && (
        <div className="text-[11px] text-destructive/90 px-0.5">{tool.error}</div>
      )}
    </div>
  );
}

function LiveToolRow({ tool }: { tool: ToolStatus }) {
  const [open, setOpen] = useState(false);
  const preview = argPreview(tool.args);
  const hasDetails = !!(tool.args && Object.keys(tool.args).length > 0) || tool.response !== undefined;

  return (
    <div className="stream-row-enter">
      <button
        type="button"
        onClick={() => hasDetails && setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 py-0.5 text-left text-[12px] text-muted-foreground',
          hasDetails && 'hover:text-foreground cursor-pointer',
        )}
      >
        <Loader2 className="w-3 h-3 animate-spin shrink-0 text-muted-foreground/80" />
        <span className="truncate min-w-0">
          <span className="stream-shimmer">Running</span>{' '}
          <span className="text-foreground/85">{friendlyName(tool.name)}</span>
          {preview && (
            <span className="text-muted-foreground/65"> · {preview}</span>
          )}
        </span>
      </button>
      <AnimatePresence>
        {open && hasDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <ToolDetails tool={tool} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DoneToolRow({ tool }: { tool: ToolStatus }) {
  const [open, setOpen] = useState(false);
  const hasDetails = !!(tool.args && Object.keys(tool.args).length > 0) || tool.response !== undefined || !!tool.error;
  const isError = tool.status === 'error';

  return (
    <div>
      <button
        type="button"
        onClick={() => hasDetails && setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 py-0.5 text-left text-[12px]',
          isError ? 'text-destructive/80' : 'text-muted-foreground/80',
          hasDetails && 'hover:text-foreground cursor-pointer',
        )}
      >
        {isError ? (
          <XCircle className="w-3 h-3 shrink-0" />
        ) : (
          <Check className="w-3 h-3 shrink-0 opacity-70" />
        )}
        <span className="truncate">{friendlyName(tool.name)}</span>
      </button>
      <AnimatePresence>
        {open && hasDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <ToolDetails tool={tool} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RanToolsGroup({ tools }: { tools: ToolStatus[] }) {
  const [open, setOpen] = useState(false);
  if (tools.length === 0) return null;

  if (tools.length === 1) {
    return <DoneToolRow tool={tools[0]} />;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 py-0.5 text-left text-[12px] text-muted-foreground/75 hover:text-foreground"
      >
        <Check className="w-3 h-3 shrink-0 opacity-70" />
        <span className="flex-1">
          Ran {tools.length} tools
        </span>
        {open ? <ChevronDown className="w-3 h-3 shrink-0 opacity-60" /> : <ChevronRight className="w-3 h-3 shrink-0 opacity-60" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="overflow-hidden"
          >
            <div className="ml-1 pl-3 border-l border-border/25 space-y-0.5 py-0.5">
              {tools.map((tool) => (
                <DoneToolRow key={tool.id} tool={tool} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ToolStatusDisplayProps {
  messageId?: string;
}

export default function ToolStatusDisplay({ messageId }: ToolStatusDisplayProps = {}) {
  const { activeTools, getToolsForMessage } = useAppStore();

  const tools = messageId
    ? getToolsForMessage(messageId)
    : Object.values(activeTools);

  if (tools.length === 0) {
    return null;
  }

  const active = tools.filter((t) => t.status === 'running' || t.status === 'pending');
  const errors = tools.filter((t) => t.status === 'error');
  const completed = tools.filter((t) => t.status === 'completed');

  return (
    <div className="py-0.5 space-y-0.5 pl-0.5 border-l border-border/20 ml-0.5">
      <div className="pl-2.5 space-y-0.5">
        <AnimatePresence initial={false}>
          {active.map((tool) => (
            <motion.div
              key={tool.id}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            >
              <LiveToolRow tool={tool} />
            </motion.div>
          ))}
        </AnimatePresence>
        {errors.map((tool) => (
          <DoneToolRow key={tool.id} tool={tool} />
        ))}
        <RanToolsGroup tools={completed} />
      </div>
    </div>
  );
}
