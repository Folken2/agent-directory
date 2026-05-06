'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { adkClient } from '@/lib/adk-client';
import { Message, Artifact } from '@/lib/types';
import RateLimitBanner from './RateLimitBanner';
import MessageList from './chat/MessageList';
import Composer from './chat/Composer';
import { cn } from '@/lib/utils';
import { Info, Tag, Lightbulb, Wrench } from 'lucide-react';

interface ChatInterfaceProps {
  initialPrompt?: string;
}

export default function ChatInterface({ initialPrompt }: ChatInterfaceProps) {
  const {
    selectedAgent,
    currentConversation,
    setCurrentConversation,
    addMessage,
    updateMessage,
    addConversation,
    updateConversation,
    setArtifacts,
    addArtifact,
    setLoading,
    setError,
    isLoading,
    addToolCall,
    updateToolResponse,
  } = useAppStore();

  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [currentAssistantMessageId, setCurrentAssistantMessageId] = useState<string | null>(null);
  const [currentMessageArtifacts, setCurrentMessageArtifacts] = useState<Artifact[]>([]);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    count: number;
    limit: number;
    userType: 'authenticated' | 'anonymous';
  } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);

  // Info panel default state by viewport
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => setInfoOpen(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Detect dark mode via .dark class on <html>
  useEffect(() => {
    const check = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Load existing artifacts when conversation changes
  useEffect(() => {
    const loadExistingArtifacts = async () => {
      if (!currentConversation || !selectedAgent) return;
      try {
        const sessionId = currentConversation.id.replace('conv-', 'session-');
        const response = await fetch(
          `/api/artifacts?app_name=${selectedAgent.name}&user_id=default-user&session_id=${sessionId}`,
        );
        if (!response.ok) {
          setArtifacts([]);
          return;
        }
        const result = await response.json();
        if (result.success && result.data && result.data.length > 0) {
          setArtifacts(result.data);
          const assistantMessages = currentConversation.messages.filter((m) => m.role === 'assistant');
          if (assistantMessages.length > 0) {
            const last = assistantMessages[assistantMessages.length - 1];
            if (!last.artifacts || last.artifacts.length === 0) {
              updateMessage(currentConversation.id, last.id, { artifacts: result.data });
            }
          }
        } else {
          setArtifacts([]);
        }
      } catch {
        setArtifacts([]);
      }
    };
    loadExistingArtifacts();
  }, [currentConversation?.id, selectedAgent?.name, setArtifacts, updateMessage]);

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

  const convertFileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || !selectedAgent || isLoading || isStreaming || isInitializing) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim() || (attachments.length > 0 ? `Sent ${attachments.length} file(s)` : ''),
      timestamp: new Date(),
      agentName: selectedAgent.name,
    };

    let conversation = currentConversation;
    if (!conversation) {
      conversation = {
        id: `conv-${Date.now()}`,
        title: input.trim().slice(0, 50) || 'New Conversation',
        agentName: selectedAgent.name,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      addConversation(conversation);
      setCurrentConversation(conversation);
    } else if ((!conversation.title || conversation.title === 'New Conversation') && input.trim()) {
      const updatedTitle = input.trim().slice(0, 50);
      conversation = { ...conversation, title: updatedTitle };
      setCurrentConversation(conversation);
      updateConversation(conversation.id, { title: updatedTitle });
    }

    addMessage(userMessage);
    const messageText = input.trim();
    setInput('');
    const filesToSend = [...attachments];
    setAttachments([]);
    setLoading(true);
    setIsInitializing(true);
    setIsStreaming(false);
    setStreamingContent('');
    setError(null);
    setArtifacts([]);
    setCurrentMessageArtifacts([]);
    stoppedRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const assistantMessageId = `msg-${Date.now() + 1}`;
      setCurrentAssistantMessageId(assistantMessageId);
      let fullResponse = '';
      let fullThinking = '';
      let hasReceivedFirstChunk = false;

      const sessionId = conversation.id.replace('conv-', 'session-');

      let messageContent: string | { parts: Array<{ text?: string; inline_data?: any }> } = messageText;
      if (filesToSend.length > 0) {
        const parts: Array<{ text?: string; inline_data?: any }> = [];
        if (messageText) parts.push({ text: messageText });
        for (const file of filesToSend) {
          const base64 = await convertFileToBase64(file);
          parts.push({
            inline_data: {
              mime_type: file.type || 'application/octet-stream',
              data: base64,
              filename: file.name,
            },
          });
        }
        messageContent = { parts };
      }

      try {
        let streamDone = false;
        for await (const chunk of adkClient.streamAgent(
          selectedAgent.name,
          messageContent,
          'default-user',
          sessionId,
          controller.signal,
        )) {
          if (!hasReceivedFirstChunk) {
            hasReceivedFirstChunk = true;
            setIsInitializing(false);
            setIsStreaming(true);
          }

          if (chunk.type === 'thinking' && chunk.content) {
            const newThinking = chunk.content;
            setIsThinking(true);
            if (newThinking === fullThinking && fullThinking.length > 0) continue;
            if (newThinking.length > fullThinking.length && newThinking.startsWith(fullThinking)) {
              fullThinking = newThinking;
            } else if (fullThinking.length > 0 && fullThinking.includes(newThinking)) {
              continue;
            } else {
              fullThinking += newThinking;
            }
            setStreamingThinking(fullThinking);
          } else if (chunk.type === 'text' && chunk.content) {
            if (isThinking) setIsThinking(false);
            const newContent = chunk.content;
            if (newContent === fullResponse && fullResponse.length > 0) continue;
            if (newContent.length > fullResponse.length && newContent.startsWith(fullResponse)) {
              fullResponse = newContent;
              setStreamingContent(fullResponse);
              continue;
            }
            if (fullResponse.length > 50 && newContent.length > 50) {
              const prefixLen = Math.min(50, fullResponse.length, newContent.length);
              if (newContent.substring(0, prefixLen) === fullResponse.substring(0, prefixLen)) {
                fullResponse = newContent.length >= fullResponse.length ? newContent : fullResponse;
                setStreamingContent(fullResponse);
                continue;
              }
            }
            if (fullResponse.length > 0 && fullResponse.includes(newContent)) continue;
            fullResponse += newContent;
            setStreamingContent(fullResponse);
          } else if (chunk.type === 'artifact' && chunk.artifact) {
            addArtifact(chunk.artifact);
            setCurrentMessageArtifacts((prev) => [...prev, chunk.artifact!]);
          } else if (chunk.type === 'toolCall' && chunk.toolCall) {
            addToolCall(
              {
                id: chunk.toolCall.id,
                name: chunk.toolCall.name,
                args: chunk.toolCall.args,
                status: 'running',
                isLongRunning: chunk.toolCall.status === 'running',
                startTime: new Date(),
              },
              assistantMessageId,
            );
          } else if (chunk.type === 'toolResponse' && chunk.toolResponse) {
            updateToolResponse(chunk.toolResponse.id, chunk.toolResponse.response, chunk.toolResponse.error);
          } else if (chunk.type === 'error') {
            throw new Error(chunk.error || 'Streaming error');
          } else if (chunk.type === 'done') {
            streamDone = true;
            break;
          }
        }

        setIsStreaming(false);
        setIsThinking(false);
        setIsInitializing(false);
        setStreamingContent('');
        setStreamingThinking('');
        setCurrentAssistantMessageId(null);

        if (fullResponse && streamDone) {
          let finalArtifacts = currentMessageArtifacts;
          if (finalArtifacts.length === 0) {
            try {
              const artifactsResponse = await fetch(
                `/api/artifacts?app_name=${selectedAgent.name}&user_id=default-user&session_id=${sessionId}`,
              );
              if (artifactsResponse.ok) {
                const artifactsResult = await artifactsResponse.json();
                if (artifactsResult.success && artifactsResult.data && artifactsResult.data.length > 0) {
                  finalArtifacts = artifactsResult.data;
                  setArtifacts(artifactsResult.data);
                }
              }
            } catch (error) {
              console.error('[ChatInterface] Error loading artifacts after streaming:', error);
            }
          }

          const assistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: fullResponse,
            thinking: fullThinking || undefined,
            timestamp: new Date(),
            agentName: selectedAgent.name,
            artifacts: finalArtifacts.length > 0 ? finalArtifacts : undefined,
          };
          addMessage(assistantMessage);
          setCurrentMessageArtifacts([]);
        }
      } catch (streamError: any) {
        // User clicked stop — commit whatever we streamed and exit cleanly.
        if (stoppedRef.current || streamError?.name === 'AbortError') {
          setIsStreaming(false);
          setIsThinking(false);
          setIsInitializing(false);
          setStreamingContent('');
          setStreamingThinking('');
          setCurrentAssistantMessageId(null);
          if (fullResponse.trim()) {
            const stoppedMessage: Message = {
              id: assistantMessageId,
              role: 'assistant',
              content: fullResponse,
              thinking: fullThinking || undefined,
              timestamp: new Date(),
              agentName: selectedAgent.name,
              artifacts: currentMessageArtifacts.length > 0 ? currentMessageArtifacts : undefined,
            };
            addMessage(stoppedMessage);
            setCurrentMessageArtifacts([]);
          }
          return;
        }

        if (
          streamError?.status === 429 ||
          streamError?.response?.status === 429 ||
          streamError?.message?.includes('429')
        ) {
          let rateLimitData: any = null;
          if (streamError?.response?.data?.rateLimit) rateLimitData = streamError.response.data.rateLimit;
          else if (streamError?.rateLimit) rateLimitData = streamError.rateLimit;
          if (rateLimitData) {
            setRateLimitInfo({
              count: rateLimitData.count || 0,
              limit: rateLimitData.limit || 5,
              userType: rateLimitData.userType || 'anonymous',
            });
            setError(null);
            return;
          }
        }

        setArtifacts([]);
        setIsInitializing(false);
        setIsThinking(false);
        setStreamingThinking('');

        const result = await adkClient.runAgent(
          selectedAgent.name,
          messageContent,
          'default-user',
          sessionId,
        );

        if (result.status === 'error') {
          if (result.rateLimit) {
            setRateLimitInfo({
              count: result.rateLimit.count || 0,
              limit: result.rateLimit.limit || 5,
              userType: result.rateLimit.userType || 'anonymous',
            });
            setError(null);
            return;
          }
          throw new Error(result.error || 'Failed to run agent');
        }

        let finalArtifacts: Artifact[] = [];
        if (result.artifacts && result.artifacts.length > 0) {
          finalArtifacts = result.artifacts;
          setArtifacts(result.artifacts);
        } else {
          try {
            const artifactsResponse = await fetch(
              `/api/artifacts?app_name=${selectedAgent.name}&user_id=default-user&session_id=${sessionId}`,
            );
            if (artifactsResponse.ok) {
              const artifactsResult = await artifactsResponse.json();
              if (artifactsResult.success && artifactsResult.data && artifactsResult.data.length > 0) {
                finalArtifacts = artifactsResult.data;
                setArtifacts(artifactsResult.data);
              }
            }
          } catch (error) {
            console.error('[UI] Error loading artifacts after non-streaming:', error);
          }
        }

        const assistantMessage: Message = {
          id: assistantMessageId,
          role: 'assistant',
          content: result.response || '',
          timestamp: new Date(),
          agentName: selectedAgent.name,
          artifacts: finalArtifacts.length > 0 ? finalArtifacts : undefined,
        };
        addMessage(assistantMessage);
        setCurrentMessageArtifacts([]);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      if (error?.status === 429 || error?.response?.status === 429 || error?.message?.includes('429')) {
        let rateLimitData: any = null;
        if (error?.response?.data?.rateLimit) rateLimitData = error.response.data.rateLimit;
        else if (error?.rateLimit) rateLimitData = error.rateLimit;
        if (rateLimitData) {
          setRateLimitInfo({
            count: rateLimitData.count || 0,
            limit: rateLimitData.limit || 5,
            userType: rateLimitData.userType || 'anonymous',
          });
          setError(null);
          return;
        }
      }

      setError(error.message || 'Failed to send message');
      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error.message || 'Failed to process your request. Please try again.'}`,
        timestamp: new Date(),
        agentName: selectedAgent.name,
      };
      addMessage(errorMessage);
    } finally {
      setLoading(false);
      setIsStreaming(false);
      setIsThinking(false);
      setIsInitializing(false);
      setStreamingContent('');
      setStreamingThinking('');
      setCurrentAssistantMessageId(null);
      abortControllerRef.current = null;
      stoppedRef.current = false;
    }
  };

  const handleStop = useCallback(() => {
    if (!abortControllerRef.current) return;
    stoppedRef.current = true;
    abortControllerRef.current.abort();
  }, []);

  const messages = currentConversation?.messages || [];
  const busy = isLoading || isStreaming || isInitializing;
  const gridColsClass = infoOpen ? 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]' : 'grid-cols-1';

  return (
    <div className={cn('grid gap-4 h-full', gridColsClass)}>
      <div className="flex flex-col h-full min-h-0 bg-background relative">
        <div className="px-4 pt-3 flex items-center justify-end gap-3">
          <button
            onClick={() => setInfoOpen((open) => !open)}
            className="inline-flex items-center justify-center rounded-full border border-border bg-card hover:border-primary/40 p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={infoOpen ? 'Hide agent info' : 'Show agent info'}
            title={infoOpen ? 'Hide agent info' : 'Show agent info'}
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

        {rateLimitInfo && (
          <div className="px-4 pt-2">
            <RateLimitBanner
              count={rateLimitInfo.count}
              limit={rateLimitInfo.limit}
              userType={rateLimitInfo.userType}
              onDismiss={() => setRateLimitInfo(null)}
            />
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
          'bg-card rounded-2xl border border-border shadow-sm overflow-y-auto p-4 xl:p-6',
          infoOpen ? 'block' : 'hidden',
        )}
      >
        {selectedAgent ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-[11px] font-semibold bg-primary/10 text-primary rounded-md border border-primary/20">
                    Agent
                  </span>
                  <span className="text-xs text-muted-foreground">{selectedAgent.name}</span>
                </div>
                <h3 className="text-lg font-semibold text-foreground mt-1 leading-tight">
                  {selectedAgent.displayName || selectedAgent.name}
                </h3>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              {selectedAgent.description || 'No description available'}
            </p>

            {selectedAgent.tags && selectedAgent.tags.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Tag className="w-3 h-3" />
                  <span>Tags</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedAgent.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1.5 text-xs font-medium bg-primary/5 text-primary rounded-lg border border-primary/20"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedAgent.tools && selectedAgent.tools.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Wrench className="w-3 h-3" />
                  <span>Tools</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedAgent.tools.map((tool) => (
                    <span
                      key={tool}
                      className="px-2.5 py-1 text-xs font-medium bg-muted text-muted-foreground rounded-md border border-border/50"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedAgent.useCases && selectedAgent.useCases.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Lightbulb className="w-3 h-3 text-amber-500" />
                  <span>Use cases</span>
                </div>
                <div className="space-y-2">
                  {selectedAgent.useCases.map((useCase, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 text-sm text-foreground leading-relaxed bg-muted/30 border border-border/60 rounded-lg px-3 py-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 inline-flex" />
                      <span>{useCase.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Select an agent to view details and quick prompts.
          </div>
        )}
      </div>
    </div>
  );
}
