'use client';

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Message } from '@/lib/types';
import { filterInternalInstructions } from '@/lib/instruction-filter';
import { MarkdownRenderer } from './markdown';
import ToolStatusDisplay from '../ToolStatusDisplay';
import ThinkingBlock from '../ThinkingBlock';
import InlineArtifact from '../InlineArtifact';

function safeParseDate(date: any): Date | undefined {
  if (!date) return undefined;
  try {
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function getDisplayContent(raw: any): string {
  if (raw === null || raw === undefined) return '';
  const asString = typeof raw === 'string' ? raw : JSON.stringify(raw);
  const trimmed = asString.trim();
  if (!trimmed) return '';

  let extractedText = '';
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const keys = Object.keys(parsed);
      const hasArtifacts = Array.isArray((parsed as any).artifacts);
      const otherKeys = keys.filter((k) => k !== 'artifacts');
      if (hasArtifacts && otherKeys.length === 0) return '';
      if (typeof (parsed as any).response === 'string') extractedText = (parsed as any).response.trim();
      else if (typeof (parsed as any).text === 'string') extractedText = (parsed as any).text.trim();
      else if (typeof (parsed as any).message === 'string') extractedText = (parsed as any).message.trim();
      else extractedText = trimmed;
    } else {
      extractedText = trimmed;
    }
  } catch {
    extractedText = trimmed;
  }
  return filterInternalInstructions(extractedText);
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
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="flex w-full justify-end"
        title={timestamp?.toLocaleString()}
      >
        <div className="max-w-[85%] rounded-2xl bg-muted/60 px-4 py-2 text-foreground/90 text-left">
          <MarkdownRenderer
            content={text}
            isStreaming={false}
            isDarkMode={isDarkMode}
          />
        </div>
      </motion.div>
    );
  }

  const displayContent = getDisplayContent(message.content);
  const hasArtifacts = !!(message.artifacts && message.artifacts.length > 0);
  const showAnything = !!displayContent || hasArtifacts;
  const isCopied = copiedMessageId === message.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="group/msg flex w-full justify-start"
      title={timestamp?.toLocaleString()}
    >
      <div className="max-w-3xl w-full space-y-2">
        <ToolStatusDisplay messageId={message.id} />
        {message.thinking && <ThinkingBlock content={message.thinking} />}

        {showAnything && (
          <div className="text-foreground">
            {displayContent && (
              <MarkdownRenderer content={displayContent} isStreaming={false} isDarkMode={isDarkMode} />
            )}

            {hasArtifacts && (
              <div className={cn('space-y-3', displayContent && 'mt-4')}>
                {message.artifacts!.map((artifact) => (
                  <InlineArtifact key={artifact.id} artifact={artifact} />
                ))}
              </div>
            )}

            {(displayContent || (hasArtifacts && message.artifacts!.length > 1)) && (
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
                {hasArtifacts && message.artifacts!.length > 1 && (
                  <button
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted/70 transition-colors"
                    onClick={() => {
                      message.artifacts?.forEach((a) => {
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
export { getDisplayContent, safeParseDate };
