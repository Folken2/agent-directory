import { db } from './drizzle/db';
import { agentStats, agentRunEvents } from './drizzle/schema';
import { eq, sql } from 'drizzle-orm';
import { ensureAgentRunEventsSchema } from './analytics/ensure-schema';

/**
 * Check if database is available
 */
function isDbAvailable(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export type TrackAgentRunIdentity = {
  visitorId?: string | null;
  anonSessionToken?: string | null;
};

/**
 * Track an agent run event and update agent stats
 * Only increments runs counter when status is 'completed' or 'error' to avoid double-counting
 */
export async function trackAgentRun(
  agentSlug: string,
  userId: string,
  sessionId: string,
  appName: string,
  status: 'pending' | 'running' | 'completed' | 'error' = 'completed',
  errorMessage?: string,
  rateLimitIdentifier?: string,
  identity?: TrackAgentRunIdentity
) {
  // Skip tracking if database is not available
  if (!isDbAvailable()) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[trackAgentRun] Database not available, skipping tracking');
    }
    return;
  }

  try {
    await ensureAgentRunEventsSchema();

    // Create run event — visitor/anon stamps stay null when cookies are absent
    await db.insert(agentRunEvents).values({
      agentSlug,
      userId,
      sessionId,
      appName,
      status,
      errorMessage: errorMessage || null,
      rateLimitIdentifier: rateLimitIdentifier || null,
      visitorId: identity?.visitorId || null,
      anonSessionToken: identity?.anonSessionToken || null,
      completedAt: status === 'completed' || status === 'error' ? new Date() : null,
    });

    // Only increment runs counter when run is completed or errored
    // This prevents double-counting when tracking 'running' status first, then 'completed'
    if (status === 'completed' || status === 'error') {
      await db
        .insert(agentStats)
        .values({
          agentSlug,
          runs: 1,
          lastRunAt: new Date(),
        })
        .onConflictDoUpdate({
          target: agentStats.agentSlug,
          set: {
            runs: sql`${agentStats.runs} + 1`,
            lastRunAt: new Date(),
          },
        });
    } else {
      // For 'running' or 'pending' status, just ensure the stats row exists without incrementing
      await db
        .insert(agentStats)
        .values({
          agentSlug,
          runs: 0,
          lastRunAt: null,
        })
        .onConflictDoNothing();
    }
  } catch (error) {
    // Don't fail the request if tracking fails, but log with more detail
    console.error('Error tracking agent run:', {
      agentSlug,
      status,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

/**
 * Get agent run count
 */
export async function getAgentRunCount(agentSlug: string): Promise<number> {
  try {
    const result = await db
      .select({ runs: agentStats.runs })
      .from(agentStats)
      .where(eq(agentStats.agentSlug, agentSlug))
      .limit(1);

    return result[0]?.runs ?? 0;
  } catch (error) {
    console.error('Error getting agent run count:', error);
    return 0;
  }
}

/**
 * Get recent agent runs
 */
export async function getRecentAgentRuns(
  agentSlug: string,
  limit: number = 10
) {
  try {
    return await db
      .select()
      .from(agentRunEvents)
      .where(eq(agentRunEvents.agentSlug, agentSlug))
      .orderBy(sql`${agentRunEvents.createdAt} DESC`)
      .limit(limit);
  } catch (error) {
    console.error('Error getting recent agent runs:', error);
    return [];
  }
}
