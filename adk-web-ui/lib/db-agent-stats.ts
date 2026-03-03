import { db } from './drizzle/db';
import { agentStats, agentStarEvents } from './drizzle/schema';
import { eq, sql, and, inArray } from 'drizzle-orm';

type AgentStatsRow = {
  agent_slug: string;
  stars_count: number | null;
  runs: number | null;
  last_run_at: string | null;
};

/**
 * Check if database is available
 */
function isDbAvailable(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Get agent stats for multiple agents
 */
export async function getAgentStatsMap(agentSlugs: string[]): Promise<Record<string, AgentStatsRow>> {
  if (agentSlugs.length === 0) return {};

  // Skip if database is not available
  if (!isDbAvailable()) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[getAgentStatsMap] Database not available, returning empty stats');
    }
    return {};
  }

  try {
    // Use Drizzle's `inArray` for better type safety and performance
    const rows = await db
      .select({
        agent_slug: agentStats.agentSlug,
        stars_count: agentStats.starsCount,
        runs: agentStats.runs,
        last_run_at: agentStats.lastRunAt,
      })
      .from(agentStats)
      .where(inArray(agentStats.agentSlug, agentSlugs));

    const map: Record<string, AgentStatsRow> = {};
    rows.forEach((row) => {
      map[row.agent_slug] = {
        agent_slug: row.agent_slug,
        stars_count: row.stars_count ?? 0,
        runs: row.runs ?? 0,
        last_run_at: row.last_run_at?.toISOString() ?? null,
      };
    });
    return map;
  } catch (error) {
    console.error('Error getting agent stats:', {
      error: error instanceof Error ? error.message : String(error),
      agentSlugs: agentSlugs.slice(0, 5), // Log first 5 for debugging
      stack: error instanceof Error ? error.stack : undefined,
    });
    return {};
  }
}

/**
 * Ensure agent stats row exists
 */
export async function ensureAgentStatsRow(agentSlug: string) {
  try {
    await db
      .insert(agentStats)
      .values({
        agentSlug,
        starsCount: 0,
        runs: 0,
      })
      .onConflictDoNothing();
  } catch (error) {
    console.error('Error ensuring agent stats row:', error);
  }
}

/**
 * Star an agent
 */
export async function starAgent(agentSlug: string, sessionId: string) {
  await ensureAgentStatsRow(agentSlug);

  try {
    // Try to insert star event - only increment if insert succeeds
    const insertResult = await db
      .insert(agentStarEvents)
      .values({
        agentSlug,
        sessionId,
      })
      .onConflictDoNothing()
      .returning({ id: agentStarEvents.id });

    // Only update stats if a new star was actually inserted
    if (insertResult.length > 0) {
      const result = await db
        .update(agentStats)
        .set({
          starsCount: sql`${agentStats.starsCount} + 1`,
        })
        .where(eq(agentStats.agentSlug, agentSlug))
        .returning({ starsCount: agentStats.starsCount });

      return { starsCount: result[0]?.starsCount ?? 0 };
    }

    // Star already exists, return current count
    const current = await db
      .select({ starsCount: agentStats.starsCount })
      .from(agentStats)
      .where(eq(agentStats.agentSlug, agentSlug))
      .limit(1);

    return { starsCount: current[0]?.starsCount ?? 0 };
  } catch (error) {
    console.error('Error starring agent:', error);
    throw error;
  }
}

/**
 * Unstar an agent
 */
export async function unstarAgent(agentSlug: string, sessionId: string) {
  await ensureAgentStatsRow(agentSlug);

  try {
    // Delete star event
    await db
      .delete(agentStarEvents)
      .where(
        and(
          eq(agentStarEvents.agentSlug, agentSlug),
          eq(agentStarEvents.sessionId, sessionId)
        )
      );

    // Update stats
    const result = await db
      .update(agentStats)
      .set({
        starsCount: sql`GREATEST(${agentStats.starsCount} - 1, 0)`,
      })
      .where(eq(agentStats.agentSlug, agentSlug))
      .returning({ starsCount: agentStats.starsCount });

    return { starsCount: result[0]?.starsCount ?? 0 };
  } catch (error) {
    console.error('Error unstarring agent:', error);
    throw error;
  }
}

