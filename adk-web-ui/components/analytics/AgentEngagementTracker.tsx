'use client';

import { useEffect, useRef } from 'react';
import { trackEngagement, trackGtagEvent } from '@/lib/analytics/track-engagement';

const HEARTBEAT_MS = 30_000;

/**
 * Active-use dwell on the chat surface for a selected agent.
 * Heartbeats only while the tab is visible; no-ops without consent.
 */
export default function AgentEngagementTracker({
  agentSlug,
  sessionKey,
}: {
  agentSlug: string | null | undefined;
  sessionKey?: string | null;
}) {
  const lastBeat = useRef<number>(Date.now());
  const opened = useRef<string | null>(null);

  useEffect(() => {
    if (!agentSlug) return;

    if (opened.current !== agentSlug) {
      opened.current = agentSlug;
      lastBeat.current = Date.now();
      trackEngagement({
        eventType: 'agent_open',
        agentSlug,
        sessionKey,
      });
      trackGtagEvent('agent_open', { agent_slug: agentSlug });
    }

    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      const durationMs = now - lastBeat.current;
      lastBeat.current = now;
      if (durationMs < 1_000) return;
      trackEngagement({
        eventType: 'heartbeat',
        agentSlug,
        sessionKey,
        durationMs,
      });
    };

    const id = window.setInterval(tick, HEARTBEAT_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        lastBeat.current = Date.now();
      } else {
        tick();
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      tick();
    };
  }, [agentSlug, sessionKey]);

  return null;
}
