/**
 * Server-side data layer for chat sessions.
 *
 * Why this exists: ADK writes session events with user_id='default-user'
 * regardless of who's signed in (sessions/events tables are owned by the
 * Python ADK server, which we can't change without forking). The bridge
 * between an authenticated `users.id` and ADK's `(app_name, user_id,
 * session_id)` triple is `agent_run_events.rate_limit_identifier`, populated
 * with the auth user's UUID for authenticated runs (see lib/rate-limit.ts).
 *
 * Every function in this module enforces ownership through that bridge — no
 * route or component should read `events` / `agent_run_events` directly.
 *
 * Conventions:
 *   - "Terminal" run events are { completed | error }; we count those only,
 *     because each run also writes a `running` event upfront and we'd
 *     double-count otherwise (see lib/rate-limit.ts:222 for the same logic).
 *   - `sessionId` strings always have the `session-` prefix; convert via
 *     lib/ids.ts before mixing with the chat UI.
 */

import { db } from './drizzle/db';
import { agentRunEvents } from './drizzle/schema';
import { sql, and, eq, inArray, desc } from 'drizzle-orm';
import { asSessionId, type SessionId } from './ids';

const TERMINAL_STATUSES = ['completed', 'error'] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChatSessionSummary = {
  sessionId: SessionId;
  agentSlug: string;
  /** ADK's user_id field — always 'default-user' today, but kept for clarity. */
  adkUserId: string;
  /** First user-authored text turn, if any. Used for sidebar previews. */
  firstMessage: string | null;
  /** Number of user-authored turns. */
  messageCount: number;
  startedAt: string;
  lastActivityAt: string;
};

export type ChatSessionTurn = {
  author: 'user' | 'assistant';
  text: string;
  at: string;
};

export type ChatSessionTranscript = {
  sessionId: SessionId;
  agentSlug: string;
  turns: ChatSessionTurn[];
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * List the authenticated user's chat sessions, optionally scoped to one agent.
 * Sorted newest-first by last activity.
 */
export async function listSessionsForUser(
  authedUserId: string,
  agentSlug?: string
): Promise<ChatSessionSummary[]> {
  const conditions = [
    eq(agentRunEvents.rateLimitIdentifier, authedUserId),
    inArray(agentRunEvents.status, [...TERMINAL_STATUSES]),
  ];
  if (agentSlug) {
    conditions.push(eq(agentRunEvents.agentSlug, agentSlug));
  }

  const summaries = await db
    .select({
      sessionId: agentRunEvents.sessionId,
      agentSlug: agentRunEvents.agentSlug,
      adkUserId: agentRunEvents.userId,
      startedAt: sql<Date>`min(${agentRunEvents.createdAt})`,
      lastActivityAt: sql<Date>`max(${agentRunEvents.createdAt})`,
    })
    .from(agentRunEvents)
    .where(and(...conditions))
    .groupBy(agentRunEvents.sessionId, agentRunEvents.agentSlug, agentRunEvents.userId)
    .orderBy(desc(sql`max(${agentRunEvents.createdAt})`));

  if (summaries.length === 0) return [];

  // Pull first user message + count per session in one query. We use IN (...)
  // with sql.join because drizzle-orm's neon-http driver expands a JS array
  // into a tuple of bind params, not a Postgres array — so `= ANY($arr)`
  // errors with "requires array on right side" in production.
  const sessionIds = summaries.map((r) => r.sessionId);
  const sessionIdList = sql.join(
    sessionIds.map((id) => sql`${id}`),
    sql`, `
  );
  const previewResult = await db.execute<{
    session_id: string;
    app_name: string;
    user_id: string;
    first_message: string | null;
    message_count: number;
  }>(sql`
    SELECT
      e.session_id,
      e.app_name,
      e.user_id,
      (
        SELECT (
          SELECT string_agg(p->>'text', ' ')
          FROM jsonb_array_elements(e2.content->'parts') p
          WHERE p ? 'text'
        )
        FROM events e2
        WHERE e2.session_id = e.session_id
          AND e2.app_name = e.app_name
          AND e2.user_id = e.user_id
          AND e2.author = 'user'
          AND e2.content IS NOT NULL
        ORDER BY e2.timestamp ASC
        LIMIT 1
      ) AS first_message,
      (
        SELECT COUNT(*)::int
        FROM events e3
        WHERE e3.session_id = e.session_id
          AND e3.app_name = e.app_name
          AND e3.user_id = e.user_id
          AND e3.author = 'user'
      ) AS message_count
    FROM events e
    WHERE e.session_id IN (${sessionIdList})
    GROUP BY e.session_id, e.app_name, e.user_id
  `);

  // db.execute return shape varies across drivers; normalize.
  const previewRows = unwrapExecuteRows<{
    session_id: string;
    app_name: string;
    user_id: string;
    first_message: string | null;
    message_count: number;
  }>(previewResult);
  const previewByKey = new Map<string, { firstMessage: string | null; messageCount: number }>();
  for (const row of previewRows) {
    previewByKey.set(`${row.session_id}|${row.app_name}|${row.user_id}`, {
      firstMessage: row.first_message,
      messageCount: Number(row.message_count) || 0,
    });
  }

  return summaries.map((r) => {
    const preview = previewByKey.get(`${r.sessionId}|${r.agentSlug}|${r.adkUserId}`);
    return {
      sessionId: asSessionId(r.sessionId),
      agentSlug: r.agentSlug,
      adkUserId: r.adkUserId,
      firstMessage: preview?.firstMessage ?? null,
      messageCount: preview?.messageCount ?? 0,
      startedAt: new Date(r.startedAt).toISOString(),
      lastActivityAt: new Date(r.lastActivityAt).toISOString(),
    };
  });
}

/**
 * Fetch the full transcript for a session the authenticated user owns.
 * Returns null if the user doesn't own the session (or it doesn't exist).
 *
 * Only text-bearing turns are returned — function-call / artifact-only events
 * have no `text` after jsonb extraction and are filtered out. Faithful
 * replay of tool calls and artifacts is a future concern; today we just
 * preserve the visible chat thread.
 */
export async function getSessionTranscriptForUser(
  authedUserId: string,
  sessionId: string
): Promise<ChatSessionTranscript | null> {
  const ownership = await db
    .select({
      agentSlug: agentRunEvents.agentSlug,
      adkUserId: agentRunEvents.userId,
    })
    .from(agentRunEvents)
    .where(
      and(
        eq(agentRunEvents.rateLimitIdentifier, authedUserId),
        eq(agentRunEvents.sessionId, sessionId)
      )
    )
    .limit(1);
  if (ownership.length === 0) return null;

  const { agentSlug, adkUserId } = ownership[0];

  const result = await db.execute<{
    author: string;
    text: string | null;
    timestamp: Date;
  }>(sql`
    SELECT
      author,
      timestamp,
      (
        SELECT string_agg(p->>'text', E'\n')
        FROM jsonb_array_elements(content->'parts') p
        WHERE p ? 'text' AND length(p->>'text') > 0
      ) AS text
    FROM events
    WHERE session_id = ${sessionId}
      AND app_name = ${agentSlug}
      AND user_id = ${adkUserId}
      AND content IS NOT NULL
      AND (partial IS NULL OR partial = false)
    ORDER BY timestamp ASC
  `);

  const turns: ChatSessionTurn[] = unwrapExecuteRows<{
    author: string;
    text: string | null;
    timestamp: Date;
  }>(result)
    .filter((r) => r.text && r.text.trim().length > 0)
    .map((r) => ({
      author: r.author === 'user' ? 'user' : 'assistant',
      text: r.text as string,
      at: new Date(r.timestamp).toISOString(),
    }));

  return { sessionId: asSessionId(sessionId), agentSlug, turns };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function unwrapExecuteRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === 'object' && 'rows' in result) {
    return (result as { rows: T[] }).rows ?? [];
  }
  return [];
}
