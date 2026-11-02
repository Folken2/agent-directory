import { db } from '@/lib/drizzle/db';
import { engagementEvents, type NewEngagementEvent } from '@/lib/drizzle/schema/engagement-events';
import { isAnalyticsDbAvailable } from './db-available';
import { ensureEngagementSchema } from './ensure-schema';
import type { EngagementEventType } from './engagement-input';
import { bustStatsCache } from './stats-cache';

export type { EngagementEventType } from './engagement-input';

export type EngagementInput = {
  visitorId: string;
  userId?: string | null;
  agentSlug?: string | null;
  eventType: EngagementEventType;
  path: string;
  sessionKey?: string | null;
  durationMs?: number | null;
  metadata?: Record<string, unknown> | null;
};

export async function recordEngagement(input: EngagementInput): Promise<{
  recorded: boolean;
  reason?: string;
  id?: string;
}> {
  if (!isAnalyticsDbAvailable()) {
    return { recorded: false, reason: 'no_database' };
  }

  if (!input.visitorId || !input.eventType || !input.path) {
    return { recorded: false, reason: 'invalid' };
  }

  try {
    await ensureEngagementSchema();
  } catch (error) {
    console.error('[analytics] engagement schema ensure failed', error);
    return { recorded: false, reason: 'db_error' };
  }

  const row: NewEngagementEvent = {
    visitorId: input.visitorId,
    userId: input.userId ?? null,
    agentSlug: input.agentSlug ?? null,
    eventType: input.eventType,
    path: input.path.split('?')[0] || '/',
    sessionKey: input.sessionKey ?? null,
    durationMs: input.durationMs ?? null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  };

  try {
    const inserted = await db
      .insert(engagementEvents)
      .values(row)
      .returning({ id: engagementEvents.id });
    // Heartbeats arrive every 30 s per open tab; they must not churn the cache.
    if (input.eventType !== 'heartbeat') bustStatsCache();
    return { recorded: true, id: inserted[0]?.id };
  } catch (error) {
    console.error('[analytics] failed to record engagement', error);
    return { recorded: false, reason: 'db_error' };
  }
}
