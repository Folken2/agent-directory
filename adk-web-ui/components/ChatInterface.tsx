'use client';

import React, { useCallback, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { useDarkMode } from '@/lib/hooks/useDarkMode';
import { useArtifactsForConversation } from '@/lib/hooks/useArtifactsForConversation';
import { useStreamingChat } from '@/lib/hooks/useStreamingChat';
import RateLimitBanner from './RateLimitBanner';
import MessageList from './chat/MessageList';
import Composer from './chat/Composer';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';

interface ChatInterfaceProps {
  initialPrompt?: string;
}

export default function ChatInterface({ initialPrompt }: ChatInterfaceProps) {
  const { selectedAgent, currentConversation } = useAppStore();

  // UI-only state. Streaming state, abort handling, message accumulation —
  // everything related to "the chat is alive right now" — lives in the
  // useStreamingChat hook below.
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  const isDarkMode = useDarkMode();
  // Hydrate artifacts from the ADK server when a conversation is loaded.
  useArtifactsForConversation(currentConversation, selectedAgent);

  const {
    send,
    stop,
    rateLimitInfo,
    dismissRateLimit,
    isStreaming,
    isInitializing,
    isThinking,
    streamingContent,
    streamingThinking,
    currentAssistantMessageId,
    currentMessageArtifacts,
    streamingSubAgentSteps,
    busy,
  } = useStreamingChat();

  const handleAttachFiles = useCallback((files: File[]) => {
    setAttachments((prev) => [...prev, ...files]);
  }, []);

  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleCopyMessage = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(id);
      setTimeout(() => setCopiedMessageId((prev) => (prev === id ? null : prev)), 1500);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  }, []);

  const handlePromptClick = useCallback((prompt: string) => {
    setInput(prompt);
  }, []);

  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) return;
    const text = input;
    const files = attachments;
    setInput('');
    setAttachments([]);
    await send({ text, attachments: files });
  };

  const handleStop = stop;

  const messages = currentConversation?.messages || [];
  const gridColsClass = infoOpen ? 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px]' : 'grid-cols-1';

  return (
    <div className={cn('grid h-full', gridColsClass)}>
      <div className="flex flex-col h-full min-h-0 bg-background relative">
        <div className="px-4 pt-3 flex items-center justify-end gap-3">
          <button
            onClick={() => setInfoOpen((open) => !open)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-label-medium text-md-on-surface-variant hover:text-foreground hover:bg-muted transition-colors"
            aria-label={infoOpen ? 'Hide agent info' : 'Show agent info'}
          >
            <Info className="w-3.5 h-3.5" />
            <span>{infoOpen ? 'Hide details' : 'Agent details'}</span>
          </button>
        </div>

        {rateLimitInfo && (
          <div className="px-4 pt-2">
            <RateLimitBanner
              count={rateLimitInfo.count}
              limit={rateLimitInfo.limit}
              userType={rateLimitInfo.userType}
              onDismiss={dismissRateLimit}
            />
          </div>
        )}

        {currentConversation?.resumedFrom && (
          <div className="px-4 pt-2">
            <div className="flex items-start gap-2 rounded-md border border-border/50 bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div>
                Resumed from{' '}
                {new Date(currentConversation.resumedFrom).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
                . The agent has full context. Tool calls, sub-agent steps, and
                attachments from the original session aren&apos;t re-rendered.
              </div>
            </div>
          </div>
        )}

        <MessageList
          messages={messages}
          agent={selectedAgent}
          isDarkMode={isDarkMode}
          copiedMessageId={copiedMessageId}
          onCopy={handleCopyMessage}
          onPromptClick={handlePromptClick}
          isStreaming={isStreaming}
          isInitializing={isInitializing}
          isThinking={isThinking}
          streamingContent={streamingContent}
          streamingThinking={streamingThinking}
          currentAssistantMessageId={currentAssistantMessageId}
          currentMessageArtifacts={currentMessageArtifacts}
          streamingSubAgentSteps={streamingSubAgentSteps}
        />

        <div className="bg-background/90 backdrop-blur-lg sticky bottom-0 z-10 relative">
          <Composer
            value={input}
            onChange={setInput}
            onSend={handleSend}
            onStop={handleStop}
            attachments={attachments}
            onAttachFiles={handleAttachFiles}
            onRemoveAttachment={handleRemoveAttachment}
            agentName={selectedAgent?.name ?? null}
            busy={busy}
            initialPrompt={initialPrompt}
          />
        </div>
      </div>

      <div
        className={cn(
          'border-l border-border/40 overflow-y-auto bg-background',
          infoOpen ? 'block' : 'hidden',
        )}
      >
        {selectedAgent ? (
          <div className="px-5 py-6 space-y-7">
            <section>
              <p className="text-label-small text-md-on-surface-variant/70 uppercase tracking-widest">
                About
              </p>
              <p className="mt-2 text-[13px] text-foreground/90 leading-relaxed">
                {selectedAgent.description || 'No description available'}
              </p>
            </section>

            {selectedAgent.tags && selectedAgent.tags.length > 0 && (
              <section>
                <p className="text-label-small text-md-on-surface-variant/70 uppercase tracking-widest">
                  Tags
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedAgent.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-[11px] font-medium text-muted-foreground bg-muted/60 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {selectedAgent.tools && selectedAgent.tools.length > 0 && (
              <section>
                <p className="text-label-small text-md-on-surface-variant/70 uppercase tracking-widest">
                  Tools
                </p>
                <ul className="mt-2 space-y-1">
                  {selectedAgent.tools.map((tool) => (
                    <li
                      key={tool}
                      className="text-[12px] font-mono text-muted-foreground"
                    >
                      {tool}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {selectedAgent.useCases && selectedAgent.useCases.length > 0 && (
              <section>
                <p className="text-label-small text-md-on-surface-variant/70 uppercase tracking-widest">
                  Use cases
                </p>
                <ul className="mt-2 space-y-1.5">
                  {selectedAgent.useCases.map((useCase, idx) => (
                    <li
                      key={idx}
                      className="text-[13px] text-foreground/85 leading-relaxed"
                    >
                      {useCase.description}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {selectedAgent.githubUrl && (
              <section>
                <p className="text-label-small text-md-on-surface-variant/70 uppercase tracking-widest">
                  Source
                </p>
                <a
                  href={selectedAgent.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1-.02-1.96-3.2.7-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.95 10.95 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
                  </svg>
                  View on GitHub
                </a>
              </section>
            )}
          </div>
        ) : (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            Select an agent to view details.
          </div>
        )}
      </div>
    </div>
  );
}
