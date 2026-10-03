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
          'hover:bg-md-surface-container/40',
          isStreaming && 'text-md-on-surface/80',
        )}
      >
        <Brain
          className={cn(
            'w-3.5 h-3.5 text-md-on-surface-variant shrink-0',
            isStreaming && 'animate-pulse',
          )}
        />
        <span
          className={cn(
            'text-xs flex-1',
            isStreaming ? 'stream-shimmer' : 'text-md-on-surface-variant',
          )}
        >
          {isStreaming ? 'Thinking' : 'Thought process'}
        </span>
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-md-on-surface-variant" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-md-on-surface-variant" />
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
                'mt-1 px-3 py-2.5 rounded-lg text-sm text-md-on-surface-variant',
                'bg-md-surface-container/20 border border-md-outline/20',
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
