'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { Agent, Message } from '@/lib/types';
import type { StreamingView } from '@/lib/hooks/useStreamingChat';
import EmptyState from './EmptyState';

const loadConversationView = () => import('./ConversationView');

const ConversationView = dynamic(loadConversationView, {
  loading: () => (
    <div className="flex justify-center py-8" role="status" aria-label="Loading conversation">
      <Loader2 className="w-5 h-5 animate-spin text-md-on-surface-variant" />
    </div>
  ),
});

/** Fetch the conversation code ahead of the first message, so replies render without a wait. */
export function preloadConversationView() {
  void loadConversationView();
}

interface MessageListProps {
  messages: Message[];
  agent: Agent | null;
  isDarkMode: boolean;
  copiedMessageId: string | null;
  onCopy: (text: string, id: string) => void;
  onPromptClick: (prompt: string) => void;
  streaming: StreamingView;
}

export default function MessageList({
  messages,
  agent,
  isDarkMode,
  copiedMessageId,
  onCopy,
  onPromptClick,
  streaming,
}: MessageListProps) {
  const isEmpty = messages.length === 0 && !streaming.isStreaming && !streaming.isInitializing;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        {isEmpty ? (
          <EmptyState agent={agent} onPromptClick={onPromptClick} />
        ) : (
          <ConversationView
            messages={messages}
            isDarkMode={isDarkMode}
            copiedMessageId={copiedMessageId}
            onCopy={onCopy}
            streaming={streaming}
          />
        )}
      </div>
    </div>
  );
}
