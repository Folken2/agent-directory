'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Artifact, SubAgentStep } from '@/lib/types';
import { MarkdownRenderer } from './markdown';
import { getDisplayContent } from './MessageBubble';
import ToolStatusDisplay from '../ToolStatusDisplay';
import ThinkingBlock from '../ThinkingBlock';
import InlineArtifact from '../InlineArtifact';
import SubAgentProgress from './SubAgentProgress';

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
  const displayContent = getDisplayContent(streamingContent);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="flex justify-start"
    >
      <div className="max-w-3xl w-full space-y-2">
        <ToolStatusDisplay messageId={messageId} />
        {streamingThinking && <ThinkingBlock content={streamingThinking} isStreaming={isThinking} />}
        {subAgentSteps && subAgentSteps.length > 0 && (
          <SubAgentProgress steps={subAgentSteps} isStreaming={true} />
        )}

        <div className="text-foreground">
          {displayContent ? (
            <div className="relative">
              <MarkdownRenderer content={displayContent} isStreaming={true} isDarkMode={isDarkMode} />
              <span className="streaming-cursor" aria-hidden="true" />
            </div>
          ) : isThinking && streamingThinking ? null : (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Thinking…</span>
            </div>
          )}

          {artifacts.length > 0 && (
            <div className="mt-4 space-y-3">
              {artifacts.map((artifact) => (
                <InlineArtifact key={artifact.id} artifact={artifact} />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
