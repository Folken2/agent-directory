'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { adkClient } from '@/lib/adk-client';
import { Message, Artifact, SubAgentStep, MapsCapture } from '@/lib/types';
import RateLimitBanner from './RateLimitBanner';
import MessageList from './chat/MessageList';
import Composer from './chat/Composer';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';

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
  const [streamingSubAgentSteps, setStreamingSubAgentSteps] = useState<SubAgentStep[]>([]);
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

  // Info panel is closed by default — users open it on demand instead of
  // drowning the chat in agent metadata on first paint.

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
    setStreamingSubAgentSteps([]);
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

      // Multi-agent routing: when the agent declares a `finalSubAgent`, only
      // text from that author streams to the main bubble. Other authors are
      // accumulated as collapsible progress steps. A transition to a new
      // author flips the previous step from "running" → "done".
      const finalAuthor = selectedAgent.finalSubAgent || selectedAgent.name;
      const subAgentSteps: SubAgentStep[] = [];
      const mapsCaptures: MapsCapture[] = [];
      const isIntermediateAuthor = (author: string | undefined): boolean =>
        !!selectedAgent.finalSubAgent &&
        !!author &&
        author !== finalAuthor &&
        author !== selectedAgent.name;
      const recordIntermediate = (author: string, content: string) => {
        const last = subAgentSteps[subAgentSteps.length - 1];
        if (last && last.author === author && last.status === 'running') {
          // Continuation of the same step — append (or replace if it's a
          // larger overlapping prefix, mirroring the main-content dedupe).
          if (content === last.content) return;
          if (content.length > last.content.length && content.startsWith(last.content)) {
            last.content = content;
          } else if (last.content.includes(content)) {
            return;
          } else {
            last.content += content;
          }
        } else {
          // New author OR same author after a finished run — close any open
          // running step from a different author, then push a fresh step.
          if (last && last.status === 'running' && last.author !== author) {
            last.status = 'done';
            last.completedAt = Date.now();
          }
          const priorRuns = subAgentSteps.filter((s) => s.author === author).length;
          subAgentSteps.push({
            author,
            content,
            status: 'running',
            startedAt: Date.now(),
            runIndex: priorRuns + 1,
          });
        }
        setStreamingSubAgentSteps([...subAgentSteps]);
      };
      const closeIntermediateOnFinalEmit = () => {
        // Whenever the final author emits text, all prior intermediate steps
        // are necessarily done.
        let mutated = false;
        for (const s of subAgentSteps) {
          if (s.status === 'running') {
            s.status = 'done';
            s.completedAt = Date.now();
            mutated = true;
          }
        }
        if (mutated) setStreamingSubAgentSteps([...subAgentSteps]);
      };

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
            // Drop thinking from intermediate sub-agents — their visible text
            // already represents the work, no need to surface internal CoT.
            if (isIntermediateAuthor(chunk.author)) continue;
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
            // Route by author: intermediate sub-agents become collapsed steps;
            // only the final author's text reaches the main bubble.
            if (isIntermediateAuthor(chunk.author)) {
              recordIntermediate(chunk.author!, chunk.content);
              continue;
            }
            // Final author emitted — close any still-running intermediate steps.
            closeIntermediateOnFinalEmit();
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
          } else if (chunk.type === 'mapsCapture' && chunk.mapsCapture) {
            mapsCaptures.push(chunk.mapsCapture);
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

          // Mark any still-running step as done — the stream is over.
          for (const s of subAgentSteps) {
            if (s.status === 'running') {
              s.status = 'done';
              s.completedAt = Date.now();
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
            subAgentSteps: subAgentSteps.length > 0 ? subAgentSteps.map((s) => ({ ...s })) : undefined,
            mapsCaptures: mapsCaptures.length > 0 ? mapsCaptures : undefined,
          };
          addMessage(assistantMessage);
          setCurrentMessageArtifacts([]);
          setStreamingSubAgentSteps([]);
        }
      } catch (streamError: any) {
        // User clicked stop — commit whatever we streamed and exit cleanly.
        if (stoppedRef.current || streamError?.name === 'AbortError') {
          setIsStreaming(false);
          setIsThinking(false);
          setIsInitializing(false);
          setStreamingContent('');
          setStreamingThinking('');
          setStreamingSubAgentSteps([]);
          setCurrentAssistantMessageId(null);
          if (fullResponse.trim() || subAgentSteps.length > 0) {
            for (const s of subAgentSteps) {
              if (s.status === 'running') {
                s.status = 'done';
                s.completedAt = Date.now();
              }
            }
            const stoppedMessage: Message = {
              id: assistantMessageId,
              role: 'assistant',
              content: fullResponse,
              thinking: fullThinking || undefined,
              timestamp: new Date(),
              agentName: selectedAgent.name,
              artifacts: currentMessageArtifacts.length > 0 ? currentMessageArtifacts : undefined,
              subAgentSteps: subAgentSteps.length > 0 ? subAgentSteps.map((s) => ({ ...s })) : undefined,
              mapsCaptures: mapsCaptures.length > 0 ? mapsCaptures : undefined,
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
      setStreamingSubAgentSteps([]);
      setCurrentAssistantMessageId(null);
      abortControllerRef.current = null;
      stoppedRef.current = false;
    }
  };

  const handleStop = useCallback(() => {
    if (!abortControllerRef.current) return;
    stoppedRef.current = true;
    // Pass a reason so dev tools / future logs read meaningfully instead of
    // "signal is aborted without reason".
    abortControllerRef.current.abort(
      new DOMException('User stopped generation', 'AbortError'),
    );
  }, []);

  const messages = currentConversation?.messages || [];
  const busy = isLoading || isStreaming || isInitializing;
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
