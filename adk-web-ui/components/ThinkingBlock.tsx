'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
}

export default function ThinkingBlock({ content, isStreaming = false }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!content) return null;

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-2 w-full text-left py-1 px-1 rounded-md transition-colors',
          'hover:bg-muted/40',
          isStreaming && 'text-foreground/80',
        )}
      >
        <Brain
          className={cn(
            'w-3.5 h-3.5 text-muted-foreground shrink-0',
            isStreaming && 'animate-pulse',
          )}
        />
        <span className="text-xs text-muted-foreground flex-1">
          {isStreaming ? 'Thinking…' : 'Thought process'}
        </span>
        {isStreaming && (
          <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-pulse" />
        )}
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                'mt-1 px-3 py-2.5 rounded-lg text-sm text-muted-foreground',
                'bg-muted/20 border border-border/20',
                'max-h-64 overflow-y-auto',
                'whitespace-pre-wrap break-words',
              )}
            >
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
