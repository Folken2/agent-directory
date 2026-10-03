'use client';

/**
 * useStreamingChat — owns the SSE chat loop and the live streaming state.
 *
 * What this hook does:
 *   - Holds all transient streaming state (content/thinking accumulators,
 *     in-flight assistant message id, sub-agent step tracker, rate-limit
 *     banner data).
 *   - Manages the AbortController + stopped flag for cancellation.
 *   - Implements `send(text, attachments)` and `stop()`.
 *   - On each chunk, dedupes overlapping text emissions (the ADK stream
 *     occasionally re-sends prefixes), routes intermediate sub-agent text
 *     into a separate progress feed, and falls back to a non-streaming
 *     run when the streaming endpoint fails for non-cancel reasons.
 *
 * What this hook does NOT do:
 *   - It doesn't manage the global agents list or the selected agent —
 *     those come from the store and are read via useAppStore.
 *   - It doesn't render anything; ChatInterface still owns the UI tree.
 *
 * Why a hook and not a class / context: the streaming state needs to flow
 * into the existing `<MessageList />` and `<Composer />` components which
 * already accept these as props. Wrapping them in a context would force a
 * second indirection; the hook returns the same shape ChatInterface used to
 * compute inline.
 *
 * Chunk handling (text dedupe, sub-agent routing, guide/maps collection)
 * lives in the pure, unit-tested `lib/chat/*` modules; this hook only maps
 * their updates onto React state and the store.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { adkClient } from '@/lib/adk-client';
import { toSessionId, newConversationId, newMessageId } from '@/lib/ids';
import type { MessageId } from '@/lib/ids';
import { Artifact, Message, SubAgentStep } from '@/lib/types';
import { StreamAssembler, type AssembledMessage } from '@/lib/chat/stream-assembler';
import { extractRateLimit, isRateLimitError, type RateLimitInfo } from '@/lib/chat/rate-limit';
import { trackEngagement, trackGtagEvent } from '@/lib/analytics/track-engagement';
import { ChatApiError, friendlyMessage, isApiErrorCode } from '@/lib/api-error';

export type { RateLimitInfo };

type InlineDataPart = { text?: string; inline_data?: { mime_type: string; data: string; filename: string } };

/** Live state of the in-flight assistant turn, as the message list renders it. */
export type StreamingView = {
  isStreaming: boolean;
  isInitializing: boolean;
  isThinking: boolean;
  content: string;
  thinking: string;
  messageId: MessageId | null;
  artifacts: Artifact[];
  subAgentSteps: SubAgentStep[];
};

export type UseStreamingChatResult = {
  streaming: StreamingView;
  send: (input: { text: string; attachments: File[] }) => Promise<void>;
  stop: () => void;
  retryLast: () => void;
  /** UI rate-limit banner data; `null` when the user is within their quota. */
  rateLimitInfo: RateLimitInfo | null;
  dismissRateLimit: () => void;
  isStreaming: boolean;
  isInitializing: boolean;
  isThinking: boolean;
  streamingContent: string;
  streamingThinking: string;
  currentAssistantMessageId: MessageId | null;
  currentMessageArtifacts: Artifact[];
  streamingSubAgentSteps: SubAgentStep[];
  busy: boolean;
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export function useStreamingChat(): UseStreamingChatResult {
  const {
    selectedAgent,
    currentConversation,
    setCurrentConversation,
    patchCurrentConversation,
    addMessage,
    setArtifacts,
    addArtifact,
    setLoading,
    setError,
    isLoading,
    addToolCall,
    updateToolResponse,
  } = useAppStore();

  const [streamingContent, setStreamingContent] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [currentAssistantMessageId, setCurrentAssistantMessageId] = useState<MessageId | null>(null);
  const [currentMessageArtifacts, setCurrentMessageArtifacts] = useState<Artifact[]>([]);
  const [streamingSubAgentSteps, setStreamingSubAgentSteps] = useState<SubAgentStep[]>([]);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);
  const lastInputRef = useRef<{ text: string; attachments: File[] } | null>(null);

  const stop = useCallback(() => {
    if (!abortControllerRef.current) return;
    stoppedRef.current = true;
    abortControllerRef.current.abort(
      new DOMException('User stopped generation', 'AbortError'),
    );
  }, []);

  const dismissRateLimit = useCallback(() => setRateLimitInfo(null), []);

  const send = useCallback(
    async ({ text, attachments }: { text: string; attachments: File[] }) => {
      if ((!text.trim() && attachments.length === 0) || !selectedAgent || isLoading || isStreaming || isInitializing) return;
      lastInputRef.current = { text, attachments };

      const userMessage: Message = {
        id: newMessageId(),
        role: 'user',
        content: text.trim() || (attachments.length > 0 ? `Sent ${attachments.length} file(s)` : ''),
        timestamp: new Date(),
        agentName: selectedAgent.name,
      };

      let conversation = currentConversation;
      if (!conversation) {
        conversation = {
          id: newConversationId(),
          title: text.trim().slice(0, 50) || 'New Conversation',
          agentName: selectedAgent.name,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setCurrentConversation(conversation);
      } else if ((!conversation.title || conversation.title === 'New Conversation') && text.trim()) {
        const updatedTitle = text.trim().slice(0, 50);
        conversation = { ...conversation, title: updatedTitle };
        patchCurrentConversation({ title: updatedTitle });
      }

      addMessage(userMessage);
      trackEngagement({
        eventType: 'message_sent',
        agentSlug: selectedAgent.name,
        sessionKey: conversation.id,
      });
      trackGtagEvent('agent_message', { agent_slug: selectedAgent.name });
      const messageText = text.trim();
      const filesToSend = [...attachments];
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
        // +1 salt: the user message just minted at Date.now() and we don't
        // want to collide with it inside the same millisecond.
        const assistantMessageId = newMessageId(1);
        setCurrentAssistantMessageId(assistantMessageId);
        let hasReceivedFirstChunk = false;
        const assembler = new StreamAssembler(selectedAgent);
        const agentName = selectedAgent.name;
        const toMessage = (m: AssembledMessage, artifacts: Artifact[]): Message => ({
          id: assistantMessageId,
          role: 'assistant',
          content: m.content,
          thinking: m.thinking,
          timestamp: new Date(),
          agentName,
          artifacts: artifacts.length > 0 ? artifacts : undefined,
          subAgentSteps: m.subAgentSteps,
          mapsCaptures: m.mapsCaptures,
          guideDocument: m.guideDocument,
          blueprint: m.blueprint,
        });

        const sessionId = toSessionId(conversation.id);

        let messageContent: string | { parts: InlineDataPart[] } = messageText;
        if (filesToSend.length > 0) {
          const parts: InlineDataPart[] = [];
          if (messageText) parts.push({ text: messageText });
          for (const file of filesToSend) {
            const base64 = await fileToBase64(file);
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
            sessionId,
            controller.signal,
          )) {
            if (!hasReceivedFirstChunk) {
              hasReceivedFirstChunk = true;
              setIsInitializing(false);
              setIsStreaming(true);
            }

            const update = assembler.apply(chunk);
            if (update.thinkingActive !== undefined) setIsThinking(update.thinkingActive);
            if (update.thinking !== undefined) setStreamingThinking(update.thinking);
            if (update.content !== undefined) setStreamingContent(update.content);
            if (update.subAgentSteps) setStreamingSubAgentSteps(update.subAgentSteps);
            if (update.artifact) {
              const artifact = update.artifact;
              addArtifact(artifact);
              setCurrentMessageArtifacts((prev) => [...prev, artifact]);
            }
            if (update.toolCallName) {
              trackEngagement({
                eventType: 'tool_call',
                agentSlug: agentName,
                sessionKey: conversation?.id,
                metadata: { tool: update.toolCallName },
              });
            }
            if (update.toolCall) {
              addToolCall(
                {
                  id: update.toolCall.id,
                  name: update.toolCall.name,
                  args: update.toolCall.args,
                  status: 'running',
                  isLongRunning: update.toolCall.status === 'running',
                  startTime: new Date(),
                },
                assistantMessageId,
              );
            }
            if (update.toolResponse) {
              updateToolResponse(update.toolResponse.id, update.toolResponse.response, update.toolResponse.error);
            }
            if (update.error) {
              const code = isApiErrorCode(update.error.code) ? update.error.code : 'internal';
              throw new ChatApiError(code, 0, isApiErrorCode(update.error.code) ? { message: update.error.message } : {});
            }
            if (update.done) {
              streamDone = true;
              break;
            }
          }

          if (assembler.content && streamDone) {
            let finalArtifacts = currentMessageArtifacts;
            if (finalArtifacts.length === 0) {
              try {
                const artifactsResponse = await fetch(
                  `/api/artifacts?app_name=${encodeURIComponent(selectedAgent.name)}&session_id=${encodeURIComponent(sessionId)}`,
                );
                if (artifactsResponse.ok) {
                  const artifactsResult = await artifactsResponse.json();
                  if (artifactsResult.success && artifactsResult.data && artifactsResult.data.length > 0) {
                    finalArtifacts = artifactsResult.data;
                    setArtifacts(artifactsResult.data);
                  }
                }
              } catch (error) {
                console.error('[useStreamingChat] Error loading artifacts after streaming:', error);
              }
            }

            // Closes running steps and resolves the guide document (state_delta,
            // else the ```guidejson``` fence) so `content` holds the lead text.
            const assistantMessage = toMessage(assembler.finalize(), finalArtifacts);
            // Commit the saved message BEFORE tearing down the streaming bubble
            // so SubAgentProgress doesn't remount through an empty gap (which
            // reset expand state and looked like an auto-collapse).
            addMessage(assistantMessage);
            setCurrentMessageArtifacts([]);
          }

          setIsStreaming(false);
          setIsThinking(false);
          setIsInitializing(false);
          setStreamingContent('');
          setStreamingThinking('');
          setCurrentAssistantMessageId(null);
          setStreamingSubAgentSteps([]);
        } catch (streamError: unknown) {
          // User clicked stop — commit whatever we streamed and exit cleanly.
          if (stoppedRef.current || (streamError instanceof Error && streamError.name === 'AbortError')) {
            setIsStreaming(false);
            setIsThinking(false);
            setIsInitializing(false);
            setStreamingContent('');
            setStreamingThinking('');
            setStreamingSubAgentSteps([]);
            setCurrentAssistantMessageId(null);
            if (assembler.content.trim() || assembler.steps.length > 0) {
              addMessage(toMessage(assembler.finalize(), currentMessageArtifacts));
              setCurrentMessageArtifacts([]);
            }
            return;
          }

          if (isRateLimitError(streamError)) {
            const info = extractRateLimit(streamError);
            if (info) {
              setRateLimitInfo(info);
              setError(null);
              return;
            }
          }

          // No silent /run retry: it re-ran the agent and double-charged quota.
          // Keep whatever streamed, then surface a retryable error.
          if (assembler.content.trim()) {
            addMessage(toMessage(assembler.finalize({ includeExtras: false }), currentMessageArtifacts));
            setCurrentMessageArtifacts([]);
          }
          throw streamError;
        }
      } catch (error: unknown) {
        if (isRateLimitError(error)) {
          const info = extractRateLimit(error);
          if (info) {
            setRateLimitInfo(info);
            setError(null);
            return;
          }
        }
        if (!(error instanceof ChatApiError)) console.error('Error sending message:', error);
        const message = error instanceof ChatApiError ? error.message : friendlyMessage('internal');
        setError(message);
        addMessage({
          id: newMessageId(),
          role: 'assistant',
          content: message,
          timestamp: new Date(),
          agentName: selectedAgent.name,
          isError: true,
        });
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
    },
    [
      selectedAgent,
      currentConversation,
      isLoading,
      isStreaming,
      isInitializing,
      currentMessageArtifacts,
      setCurrentConversation,
      patchCurrentConversation,
      addMessage,
      addArtifact,
      setArtifacts,
      setLoading,
      setError,
      addToolCall,
      updateToolResponse,
    ],
  );

  const retryLast = useCallback(() => {
    const last = lastInputRef.current;
    if (last) void send(last);
  }, [send]);

  const streaming = useMemo<StreamingView>(
    () => ({
      isStreaming,
      isInitializing,
      isThinking,
      content: streamingContent,
      thinking: streamingThinking,
      messageId: currentAssistantMessageId,
      artifacts: currentMessageArtifacts,
      subAgentSteps: streamingSubAgentSteps,
    }),
    [isStreaming, isInitializing, isThinking, streamingContent, streamingThinking, currentAssistantMessageId, currentMessageArtifacts, streamingSubAgentSteps],
  );

  return {
    streaming,
    send,
    stop,
    retryLast,
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
    busy: isLoading || isStreaming || isInitializing,
  };
}
