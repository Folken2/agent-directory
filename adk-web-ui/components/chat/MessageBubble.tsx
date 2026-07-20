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
import { MapsEmbed } from './MapsEmbed';
import SubAgentProgress from './SubAgentProgress';
import { GuideAnswer } from './guide/GuideAnswer';
import { GuideMap } from './guide/GuideMap';
import { mergeGuideWithCaptures } from '@/lib/guide/merge';
import { parseGuideDocument } from '@/lib/guide/parse';

// Note: the optional P1 detail of stacking a single MapsEmbed (attribution
// iframe) under the JS map for the selected place is intentionally omitted —
// default off per brief; the JS map + PlaceCard already carry enough
// context, and it would require lifting GuideAnswer's selection state.

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

  const displayContent = getDisplayContent(message.content);
  const hasArtifacts = !!(message.artifacts && message.artifacts.length > 0);
  const isCopied = copiedMessageId === message.id;

  // Re-validate on every render rather than trusting the stored shape: the
  // document may have been persisted/rehydrated (e.g. from history), and a
  // parse failure here must fall back to the legacy markdown + embeds path
  // rather than throwing.
  const guideDoc = message.guideDocument ? parseGuideDocument(message.guideDocument) : null;
  const mergedGuide = guideDoc ? mergeGuideWithCaptures(guideDoc, message.mapsCaptures ?? []) : null;

  const showAnything = !!displayContent || hasArtifacts || !!mergedGuide;

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

        {showAnything && (
          <div className="text-[15px] leading-relaxed text-foreground">
            {mergedGuide ? (
              <GuideAnswer
                document={mergedGuide}
                mapSlot={({ places, selectedPlaceId, onSelectPlace }) => (
                  <GuideMap
                    places={places}
                    selectedPlaceId={selectedPlaceId}
                    onSelectPlace={onSelectPlace}
                  />
                )}
              />
            ) : (
              <>
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

                {message.mapsCaptures && message.mapsCaptures.length > 0 && (
                  <div className={cn('space-y-3', displayContent && 'mt-4')}>
                    {message.mapsCaptures.map((capture, idx) => (
                      <MapsEmbed key={`${capture.captured_at}-${idx}`} capture={capture} />
                    ))}
                  </div>
                )}
              </>
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
