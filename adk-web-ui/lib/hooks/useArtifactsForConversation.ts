'use client';

import { useEffect } from 'react';
import { Agent, ChatConversation } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { toSessionId } from '@/lib/ids';

/**
 * Loads any artifacts that already exist on the ADK server for the current
 * conversation/session. Used when a chat is opened (fresh or resumed) so the
 * artifact panel reflects what the agent previously produced.
 *
 * Side effects: calls setArtifacts on the global store and patches the last
 * assistant message's artifacts field if it doesn't already have any.
 */
export function useArtifactsForConversation(
  conversation: ChatConversation | null,
  agent: Agent | null
): void {
  const setArtifacts = useAppStore((s) => s.setArtifacts);
  const updateMessage = useAppStore((s) => s.updateMessage);

  useEffect(() => {
    if (!conversation || !agent) return;
    let cancelled = false;
    (async () => {
      try {
        const sessionId = toSessionId(conversation.id);
        const response = await fetch(
          `/api/artifacts?app_name=${agent.name}&user_id=default-user&session_id=${sessionId}`,
        );
        if (cancelled) return;
        if (!response.ok) {
          setArtifacts([]);
          return;
        }
        const result = await response.json();
        if (cancelled) return;
        if (!result.success || !result.data || result.data.length === 0) {
          setArtifacts([]);
          return;
        }
        setArtifacts(result.data);
        const assistantMessages = conversation.messages.filter((m) => m.role === 'assistant');
        if (assistantMessages.length > 0) {
          const last = assistantMessages[assistantMessages.length - 1];
          if (!last.artifacts || last.artifacts.length === 0) {
            updateMessage(last.id, { artifacts: result.data });
          }
        }
      } catch {
        if (!cancelled) setArtifacts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversation?.id, agent?.name, setArtifacts, updateMessage]);
}
