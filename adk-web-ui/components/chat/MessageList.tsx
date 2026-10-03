'use client';

import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Agent, Message } from '@/lib/types';
import type { StreamingView } from '@/lib/hooks/useStreamingChat';
import MessageBubble from './MessageBubble';
import StreamingBubble from './StreamingBubble';
import EmptyState from './EmptyState';

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
  const {
    isStreaming,
    isInitializing,
    isThinking,
    content: streamingContent,
    thinking: streamingThinking,
    messageId: currentAssistantMessageId,
    artifacts: currentMessageArtifacts,
    subAgentSteps: streamingSubAgentSteps,
  } = streaming;
  const endRef = useRef<HTMLDivElement>(null);

  // Stick to bottom while streaming (including sub-agent step updates).
  // Use instant scroll during live updates so long tool/sub-agent runs don't lag.
  useEffect(() => {
    const live = isStreaming || isInitializing || streamingSubAgentSteps.length > 0;
    endRef.current?.scrollIntoView({ behavior: live ? 'auto' : 'smooth', block: 'end' });
  }, [
    messages,
    streamingContent,
    streamingThinking,
    streamingSubAgentSteps,
    currentMessageArtifacts,
    isStreaming,
    isInitializing,
  ]);

  const showStreamingBubble =
    isStreaming &&
    currentAssistantMessageId &&
    !messages.find((m) => m.id === currentAssistantMessageId);

  const isEmpty = messages.length === 0 && !isStreaming && !isInitializing;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        {isEmpty ? (
          <EmptyState agent={agent} onPromptClick={onPromptClick} />
        ) : (
          <>
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isDarkMode={isDarkMode}
                  copiedMessageId={copiedMessageId}
                  onCopy={onCopy}
                />
              ))}
            </AnimatePresence>

            {showStreamingBubble && (
              <StreamingBubble
                messageId={currentAssistantMessageId!}
                streamingContent={streamingContent}
                streamingThinking={streamingThinking}
                isThinking={isThinking}
                artifacts={currentMessageArtifacts}
                isDarkMode={isDarkMode}
                subAgentSteps={streamingSubAgentSteps}
              />
            )}

            {isInitializing && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="flex items-center space-x-2 p-4">
                  <Loader2 className="w-5 h-5 animate-spin text-md-on-surface-variant" />
                  <span className="text-sm text-md-on-surface-variant">Thinking…</span>
                </div>
              </motion.div>
            )}
          </>
        )}

        <div ref={endRef} />
      </div>
    </div>
  );
}
