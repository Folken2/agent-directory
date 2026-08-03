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
 * The dedupe rules and sub-agent routing in handleChunk preserve the
 * pre-extraction behavior verbatim — see the comments at each branch for
 * why they look the way they look. Behavior change in this hook should be a
 * separate, separately-reviewed commit.
 */

import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { adkClient } from '@/lib/adk-client';
import { toSessionId, newConversationId, newMessageId } from '@/lib/ids';
import type { MessageId } from '@/lib/ids';
import {
  Artifact,
  MapsCapture,
  Message,
  SubAgentStep,
} from '@/lib/types';
import type { GuideDocument } from '@/lib/guide/types';
import { resolveGuideMessageContent } from '@/lib/guide/parse';
import { trackEngagement, trackGtagEvent } from '@/lib/analytics/track-engagement';

const ANON_RATE_LIMIT_FALLBACK = 5;

export type RateLimitInfo = {
  count: number;
  limit: number;
  userType: 'authenticated' | 'anonymous';
};

/**
 * Pulls a RateLimitInfo out of any of the three shapes our error payloads
 * can take:
 *   - error.rateLimit                       (thrown by adk-client)
 *   - error.response.data.rateLimit         (axios-style nesting)
 *   - error.rateLimit (on a result object)  (caller passes the result, not error)
 *
 * Returns null when the error isn't a 429 or doesn't carry a rate-limit
 * payload. Centralizes the defaults so the three sites that previously did
 * this inline can't drift apart.
 */
function extractRateLimit(source: unknown): RateLimitInfo | null {
  if (!source || typeof source !== 'object') return null;
  const s = source as Record<string, any>;
  const raw =
    s.rateLimit ??
    s.response?.data?.rateLimit ??
    null;
  if (!raw) return null;
  return {
    count: Number(raw.count) || 0,
    limit: Number(raw.limit) || ANON_RATE_LIMIT_FALLBACK,
    userType: raw.userType === 'authenticated' ? 'authenticated' : 'anonymous',
  };
}

/**
 * True when the given error indicates a 429 / rate-limit response, regardless
 * of which client surface emitted it (fetch error, axios-style, ADK custom).
 */
function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as Record<string, any>;
  if (e.status === 429) return true;
  if (e.response?.status === 429) return true;
  if (typeof e.message === 'string' && e.message.includes('429')) return true;
  return false;
}

export type UseStreamingChatResult = {
  send: (input: { text: string; attachments: File[] }) => Promise<void>;
  stop: () => void;
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
        let guideDocument: GuideDocument | undefined;
        const isIntermediateAuthor = (author: string | undefined): boolean =>
          !!selectedAgent.finalSubAgent &&
          !!author &&
          author !== finalAuthor &&
          author !== selectedAgent.name;

        const cloneSubAgentSteps = (): SubAgentStep[] =>
          subAgentSteps.map((s) => ({
            ...s,
            tools: s.tools ? s.tools.map((t) => ({ ...t })) : undefined,
          }));

        const publishSubAgentSteps = () => {
          setStreamingSubAgentSteps(cloneSubAgentSteps());
        };

        /** Ensure a running step exists for this author (tools/thinking may arrive before text). */
        const ensureIntermediateStep = (author: string): SubAgentStep => {
          const last = subAgentSteps[subAgentSteps.length - 1];
          if (last && last.author === author && last.status === 'running') {
            return last;
          }
          if (last && last.status === 'running' && last.author !== author) {
            last.status = 'done';
            last.completedAt = Date.now();
          }
          const priorRuns = subAgentSteps.filter((s) => s.author === author).length;
          const step: SubAgentStep = {
            author,
            content: '',
            status: 'running',
            startedAt: Date.now(),
            runIndex: priorRuns + 1,
            tools: [],
          };
          subAgentSteps.push(step);
          return step;
        };

        const appendThinking = (existing: string | undefined, incoming: string): string => {
          if (!existing) return incoming;
          if (incoming === existing) return existing;
          if (incoming.length > existing.length && incoming.startsWith(existing)) return incoming;
          if (existing.includes(incoming)) return existing;
          return existing + incoming;
        };

        const recordIntermediate = (author: string, content: string) => {
          const step = ensureIntermediateStep(author);
          if (content === step.content) return;
          if (content.length > step.content.length && content.startsWith(step.content)) {
            step.content = content;
          } else if (step.content.includes(content)) {
            return;
          } else {
            step.content += content;
          }
          publishSubAgentSteps();
        };

        const recordIntermediateThinking = (author: string, content: string) => {
          const step = ensureIntermediateStep(author);
          const next = appendThinking(step.thinking, content);
          if (next === step.thinking) return;
          step.thinking = next;
          publishSubAgentSteps();
        };

        const recordIntermediateToolCall = (
          author: string,
          tool: { id: string; name: string; args?: Record<string, unknown>; status: string },
        ) => {
          const step = ensureIntermediateStep(author);
          if (!step.tools) step.tools = [];
          const existing = step.tools.find((t) => t.id === tool.id);
          if (existing) {
            existing.name = tool.name;
            existing.args = tool.args;
            existing.status = tool.status === 'running' ? 'running' : 'pending';
          } else {
            step.tools.push({
              id: tool.id,
              name: tool.name,
              args: tool.args,
              status: tool.status === 'running' ? 'running' : 'pending',
            });
          }
          publishSubAgentSteps();
        };

        const recordIntermediateToolResponse = (
          toolResponse: { id: string; response: unknown; error?: string },
        ) => {
          for (let i = subAgentSteps.length - 1; i >= 0; i--) {
            const tool = subAgentSteps[i].tools?.find((t) => t.id === toolResponse.id);
            if (!tool) continue;
            tool.response = toolResponse.response;
            tool.error = toolResponse.error;
            tool.status = toolResponse.error ? 'error' : 'completed';
            publishSubAgentSteps();
            return;
          }
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
          if (mutated) publishSubAgentSteps();
        };

        const sessionId = toSessionId(conversation.id);

        let messageContent: string | { parts: Array<{ text?: string; inline_data?: any }> } = messageText;
        if (filesToSend.length > 0) {
          const parts: Array<{ text?: string; inline_data?: any }> = [];
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
              if (isIntermediateAuthor(chunk.author)) {
                recordIntermediateThinking(chunk.author!, chunk.content);
                continue;
              }
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
              trackEngagement({
                eventType: 'tool_call',
                agentSlug: selectedAgent.name,
                sessionKey: conversation?.id,
                metadata: { tool: chunk.toolCall.name },
              });
              if (isIntermediateAuthor(chunk.author)) {
                recordIntermediateToolCall(chunk.author!, {
                  id: chunk.toolCall.id,
                  name: chunk.toolCall.name,
                  args: chunk.toolCall.args,
                  status: chunk.toolCall.status,
                });
                continue;
              }
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
              // Prefer nesting under a sub-agent step when the id matches;
              // otherwise update the flat tool list (root / final author).
              const nested = subAgentSteps.some((s) =>
                s.tools?.some((t) => t.id === chunk.toolResponse!.id),
              );
              if (nested) {
                recordIntermediateToolResponse(chunk.toolResponse);
                continue;
              }
              if (isIntermediateAuthor(chunk.author)) {
                recordIntermediateToolResponse(chunk.toolResponse);
                continue;
              }
              updateToolResponse(chunk.toolResponse.id, chunk.toolResponse.response, chunk.toolResponse.error);
            } else if (chunk.type === 'mapsCapture' && chunk.mapsCapture) {
              mapsCaptures.push(chunk.mapsCapture);
            } else if (chunk.type === 'guideDocument' && chunk.guideDocument) {
              guideDocument = chunk.guideDocument;
            } else if (chunk.type === 'error') {
              throw new Error(chunk.error || 'Streaming error');
            } else if (chunk.type === 'done') {
              streamDone = true;
              break;
            }
          }

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
                console.error('[useStreamingChat] Error loading artifacts after streaming:', error);
              }
            }

            // Mark any still-running step as done — the stream is over.
            for (const s of subAgentSteps) {
              if (s.status === 'running') {
                s.status = 'done';
                s.completedAt = Date.now();
              }
            }

            // Client-side backup: if the guide_agent's state_delta never
            // surfaced (e.g. non-streaming fallback, dropped event), fall
            // back to parsing the ```guidejson``` fence out of the final
            // text. When a guide document is present, store its lead as
            // `content` (not the raw fenced text) so copy/chrome affordances
            // that read `message.content` show the lead instead of JSON.
            const resolved = resolveGuideMessageContent(fullResponse, guideDocument);
            guideDocument = resolved.guideDocument;
            const contentForMessage = resolved.content;

            const assistantMessage: Message = {
              id: assistantMessageId,
              role: 'assistant',
              content: contentForMessage,
              thinking: fullThinking || undefined,
              timestamp: new Date(),
              agentName: selectedAgent.name,
              artifacts: finalArtifacts.length > 0 ? finalArtifacts : undefined,
              subAgentSteps: subAgentSteps.length > 0 ? cloneSubAgentSteps() : undefined,
              mapsCaptures: mapsCaptures.length > 0 ? mapsCaptures : undefined,
              guideDocument,
            };
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
              const stoppedResolved = resolveGuideMessageContent(fullResponse, guideDocument);
              guideDocument = stoppedResolved.guideDocument;
              const stoppedContent = stoppedResolved.content;
              const stoppedMessage: Message = {
                id: assistantMessageId,
                role: 'assistant',
                content: stoppedContent,
                thinking: fullThinking || undefined,
                timestamp: new Date(),
                agentName: selectedAgent.name,
                artifacts: currentMessageArtifacts.length > 0 ? currentMessageArtifacts : undefined,
                subAgentSteps: subAgentSteps.length > 0 ? cloneSubAgentSteps() : undefined,
                mapsCaptures: mapsCaptures.length > 0 ? mapsCaptures : undefined,
                guideDocument,
              };
              addMessage(stoppedMessage);
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

          // Streaming endpoint failed for a non-cancel reason — fall back to
          // the non-streaming run endpoint. ADK's /run gives us the full
          // response in one shot; we display it as a single assistant message.
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
            const info = extractRateLimit(result);
            if (info) {
              setRateLimitInfo(info);
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
              console.error('[useStreamingChat] Error loading artifacts after non-streaming:', error);
            }
          }

          // Same fence-extraction + lead-preference logic as the streaming
          // commit path above. Pass any guideDocument accumulated before the
          // stream failed — the backend often strips the fence from /run text,
          // so the accumulated doc is the only way to keep PlaceCards + map.
          const fallbackResolved = resolveGuideMessageContent(
            result.response || '',
            guideDocument,
          );
          const assistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: fallbackResolved.content,
            timestamp: new Date(),
            agentName: selectedAgent.name,
            artifacts: finalArtifacts.length > 0 ? finalArtifacts : undefined,
            guideDocument: fallbackResolved.guideDocument,
          };
          addMessage(assistantMessage);
          setCurrentMessageArtifacts([]);
        }
      } catch (error: any) {
        console.error('Error sending message:', error);
        if (isRateLimitError(error)) {
          const info = extractRateLimit(error);
          if (info) {
            setRateLimitInfo(info);
            setError(null);
            return;
          }
        }

        setError(error.message || 'Failed to send message');
        const errorMessage: Message = {
          id: newMessageId(),
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
    },
    [
      selectedAgent,
      currentConversation,
      isLoading,
      isStreaming,
      isInitializing,
      isThinking,
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

  return {
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
    busy: isLoading || isStreaming || isInitializing,
  };
}
