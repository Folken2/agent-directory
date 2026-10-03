'use client';

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import { Message } from '@/lib/types';
import { MarkdownRenderer } from './markdown';
import ToolStatusDisplay from '../ToolStatusDisplay';
import ThinkingBlock from '../ThinkingBlock';
import SubAgentProgress from './SubAgentProgress';
import { PayloadList } from './renderers';
import { getDisplayContent, messagePayloads } from '@/lib/chat/payloads';

export function safeParseDate(date: unknown): Date | undefined {
  if (!date) return undefined;
  const parsed = new Date(date as string | number | Date);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

interface MessageBubbleProps {
  message: Message;
  isDarkMode: boolean;
  copiedMessageId: string | null;
  onCopy: (text: string, id: string) => void;
}

function MessageBubbleImpl({ message, isDarkMode, copiedMessageId, onCopy }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const timestamp = safeParseDate(message.timestamp);

  if (isUser) {
    const text = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        className="flex w-full justify-end"
        title={timestamp?.toLocaleString()}
      >
        <div className="max-w-[min(85%,36rem)] rounded-2xl bg-muted/40 px-3.5 py-2 text-[15px] leading-relaxed text-foreground/90 text-left">
          <MarkdownRenderer
            content={text}
            isStreaming={false}
            isDarkMode={isDarkMode}
          />
        </div>
      </motion.div>
    );
  }

  const payloads = messagePayloads(message);
  const displayContent = getDisplayContent(message.content);
  const artifacts = message.artifacts ?? [];
  const isCopied = copiedMessageId === message.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16 }}
      className="group/msg flex w-full justify-start"
      title={timestamp?.toLocaleString()}
    >
      <div className="max-w-3xl w-full space-y-2">
        {message.subAgentSteps && message.subAgentSteps.length > 0 ? (
          <SubAgentProgress steps={message.subAgentSteps} isDarkMode={isDarkMode} />
        ) : (
          <>
            <ToolStatusDisplay messageId={message.id} />
            {message.thinking && <ThinkingBlock content={message.thinking} />}
          </>
        )}

        {payloads.length > 0 && (
          <div className="text-[15px] leading-relaxed text-md-on-surface">
            <PayloadList payloads={payloads} isDarkMode={isDarkMode} />

            {(displayContent || artifacts.length > 1) && (
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150">
                {displayContent && (
                  <button
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted/70 transition-colors"
                    onClick={() => onCopy(displayContent, message.id)}
                    aria-label={isCopied ? 'Copied' : 'Copy message'}
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
                {artifacts.length > 1 && (
                  <button
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted/70 transition-colors"
                    onClick={() => {
                      artifacts.forEach((a) => {
                        const link = document.createElement('a');
                        link.href = a.url;
                        link.download = a.name;
                        link.click();
                      });
                    }}
                  >
                    Download all
                  </button>
                )}
                {timestamp && (
                  <span className="ml-auto text-muted-foreground/70">{timestamp.toLocaleTimeString()}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

const MessageBubble = memo(MessageBubbleImpl, (prev, next) => {
  if (prev.message !== next.message) return false;
  if (prev.isDarkMode !== next.isDarkMode) return false;
  const prevCopied = prev.copiedMessageId === prev.message.id;
  const nextCopied = next.copiedMessageId === next.message.id;
  if (prevCopied !== nextCopied) return false;
  if (prev.onCopy !== next.onCopy) return false;
  return true;
});

export default MessageBubble;
