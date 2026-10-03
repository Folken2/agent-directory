'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Artifact, SubAgentStep } from '@/lib/types';
import ToolStatusDisplay from '../ToolStatusDisplay';
import ThinkingBlock from '../ThinkingBlock';
import SubAgentProgress from './SubAgentProgress';
import { PayloadList } from './renderers';
import { messagePayloads } from '@/lib/chat/payloads';

interface StreamingBubbleProps {
  messageId: string;
  streamingContent: string;
  streamingThinking: string;
  isThinking: boolean;
  artifacts: Artifact[];
  isDarkMode: boolean;
  subAgentSteps?: SubAgentStep[];
}

export default function StreamingBubble({
  messageId,
  streamingContent,
  streamingThinking,
  isThinking,
  artifacts,
  isDarkMode,
  subAgentSteps,
}: StreamingBubbleProps) {
  const payloads = messagePayloads({ content: streamingContent, artifacts });
  const displayContent = payloads.some((p) => p.type === 'text');
  const hasSubAgents = !!(subAgentSteps && subAgentSteps.length > 0);
  const showWaiting =
    !displayContent && !hasSubAgents && !(isThinking && streamingThinking);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="flex justify-start"
    >
      <div className="max-w-3xl w-full space-y-2.5">
        <AnimatePresence mode="popLayout" initial={false}>
          {hasSubAgents ? (
            <motion.div
              key="subagents"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <SubAgentProgress steps={subAgentSteps!} isStreaming={true} isDarkMode={isDarkMode} />
            </motion.div>
          ) : (
            <motion.div
              key="tools-thinking"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="space-y-1"
            >
              <ToolStatusDisplay messageId={messageId} />
              {streamingThinking && (
                <ThinkingBlock content={streamingThinking} isStreaming={isThinking} />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-[15px] leading-relaxed text-md-on-surface">
          {showWaiting && (
            <div className="flex items-center min-h-[1.75rem] py-0.5 gap-0">
              <span className="text-sm stream-shimmer">Thinking</span>
              <span className="text-sm text-md-on-surface-variant/50 stream-dots" aria-hidden="true" />
            </div>
          )}
          {payloads.length > 0 && <PayloadList payloads={payloads} isDarkMode={isDarkMode} isStreaming />}
        </div>
      </div>
    </motion.div>
  );
}
