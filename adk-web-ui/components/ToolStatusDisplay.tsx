'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { ToolStatus } from '@/lib/types';
import { Loader2, CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

function getStatusColor(status: ToolStatus['status']) {
  switch (status) {
    case 'running':
      return 'text-foreground';
    case 'completed':
      return 'text-muted-foreground';
    case 'error':
      return 'text-destructive';
    case 'pending':
      return 'text-muted-foreground';
    default:
      return 'text-muted-foreground';
  }
}

function StatusIcon({ status }: { status: ToolStatus['status'] }) {
  switch (status) {
    case 'running':
      return <Loader2 className="w-3 h-3 animate-spin" />;
    case 'completed':
      return <CheckCircle2 className="w-3 h-3" />;
    case 'error':
      return <XCircle className="w-3 h-3" />;
    case 'pending':
      return <Clock className="w-3 h-3" />;
    default:
      return null;
  }
}

function ToolItem({ tool }: { tool: ToolStatus }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDetails = tool.args || tool.response;

  const duration = tool.startTime && tool.endTime
    ? `${Math.round((tool.endTime.getTime() - tool.startTime.getTime()) / 1000)}s`
    : tool.startTime
      ? '...'
      : '';

  return (
    <div className="text-xs">
      <div
        className={cn(
          'flex items-center gap-2 py-1 transition-colors rounded px-1',
          hasDetails && 'cursor-pointer hover:bg-muted/40',
          getStatusColor(tool.status),
        )}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
      >
        <StatusIcon status={tool.status} />
        <span className="truncate flex-1 font-medium">{tool.name}</span>
        {duration && (
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">{duration}</span>
        )}
        {hasDetails && (
          <span className="text-muted-foreground shrink-0">
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </span>
        )}
      </div>

      {/* Expandable Details */}
      <AnimatePresence>
        {isExpanded && hasDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pl-5 pr-2 pb-2 space-y-2">
              {tool.args && Object.keys(tool.args).length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                    Arguments
                  </div>
                  <pre className="text-[11px] bg-muted/50 p-2 rounded border border-border overflow-x-auto font-mono text-foreground max-h-32 overflow-y-auto">
                    {JSON.stringify(tool.args, null, 2)}
                  </pre>
                </div>
              )}
              {tool.response !== undefined && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                    Response
                  </div>
                  <pre className="text-[11px] bg-muted/50 p-2 rounded border border-border overflow-x-auto font-mono text-foreground max-h-32 overflow-y-auto">
                    {typeof tool.response === 'string'
                      ? tool.response
                      : JSON.stringify(tool.response, null, 2)}
                  </pre>
                </div>
              )}
              {tool.status === 'error' && tool.error && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-destructive mb-1">
                    Error
                  </div>
                  <div className="text-[11px] text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
                    {tool.error}
                  </div>
                </div>
              )}
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

  // If messageId is provided, show tools for that specific message
  // Otherwise, show all active tools (for streaming)
  const tools = messageId
    ? getToolsForMessage(messageId)
    : Object.values(activeTools);

  if (tools.length === 0) {
    return null;
  }

  // Group tools by status
  const runningTools = tools.filter(t => t.status === 'running' || t.status === 'pending');
  const completedTools = tools.filter(t => t.status === 'completed');
  const errorTools = tools.filter(t => t.status === 'error');

  const allTools = [...runningTools, ...completedTools, ...errorTools];

  return (
    <div className="py-0.5">
      <div className="flex items-center gap-1.5 mb-1 px-1 text-muted-foreground">
        <Wrench className="w-3 h-3" />
        <span className="text-[11px]">
          {runningTools.length > 0
            ? `Using tools · ${allTools.length}`
            : `Used ${allTools.length} tool${allTools.length === 1 ? '' : 's'}`}
        </span>
      </div>

      <div className="space-y-0.5">
        {allTools.map((tool) => (
          <ToolItem key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  );
}
