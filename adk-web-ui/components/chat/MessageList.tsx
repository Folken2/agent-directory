'use client';

import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Agent, Artifact, Message } from '@/lib/types';
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
  isStreaming: boolean;
  isInitializing: boolean;
  isThinking: boolean;
  streamingContent: string;
  streamingThinking: string;
  currentAssistantMessageId: string | null;
  currentMessageArtifacts: Artifact[];
}

export default function MessageList({
  messages,
  agent,
  isDarkMode,
  copiedMessageId,
  onCopy,
  onPromptClick,
  isStreaming,
  isInitializing,
  isThinking,
  streamingContent,
  streamingThinking,
  currentAssistantMessageId,
  currentMessageArtifacts,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, streamingThinking]);

  const showStreamingBubble =
    isStreaming &&
    currentAssistantMessageId &&
    !messages.find((m) => m.id === currentAssistantMessageId);

  const isEmpty = messages.length === 0 && !isStreaming && !isInitializing;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-8">
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
              />
            )}

            {isInitializing && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="flex items-center space-x-2 p-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Thinking…</span>
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
