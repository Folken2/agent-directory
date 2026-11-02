'use client';

import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Message } from '@/lib/types';
import type { StreamingView } from '@/lib/hooks/useStreamingChat';
import MessageBubble from './MessageBubble';
import StreamingBubble from './StreamingBubble';

export interface ConversationViewProps {
  messages: Message[];
  isDarkMode: boolean;
  copiedMessageId: string | null;
  onCopy: (text: string, id: string) => void;
  streaming: StreamingView;
}

/**
 * The messages of a started chat. Loaded on demand by MessageList: it pulls in
 * markdown, syntax highlighting and the payload renderers, none of which an
 * empty chat needs.
 */
export default function ConversationView({
  messages,
  isDarkMode,
  copiedMessageId,
  onCopy,
  streaming,
}: ConversationViewProps) {
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

  return (
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

      <div ref={endRef} />
    </>
  );
}
