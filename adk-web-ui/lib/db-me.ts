import { db } from './drizzle/db';
import { agentRunEvents } from './drizzle/schema';
import { sql, and, eq, inArray, desc } from 'drizzle-orm';

// ADK writes session events with user_id='default-user' regardless of auth, so
// the join from authenticated users to their sessions has to go through
// agent_run_events.rate_limit_identifier (which holds users.id for authed runs).

const TERMINAL = ['completed', 'error'] as const;

export type UserSession = {
  sessionId: string;
  agentSlug: string;
  adkUserId: string;
  firstMessage: string | null;
  messageCount: number;
  startedAt: string;
  lastActivityAt: string;
};

export async function listUserSessions(authedUserId: string): Promise<UserSession[]> {
  const rows = await db
    .select({
      sessionId: agentRunEvents.sessionId,
      agentSlug: agentRunEvents.agentSlug,
      adkUserId: agentRunEvents.userId,
      startedAt: sql<Date>`min(${agentRunEvents.createdAt})`,
      lastActivityAt: sql<Date>`max(${agentRunEvents.createdAt})`,
    })
    .from(agentRunEvents)
    .where(
      and(
        eq(agentRunEvents.rateLimitIdentifier, authedUserId),
        inArray(agentRunEvents.status, [...TERMINAL])
      )
    )
    .groupBy(agentRunEvents.sessionId, agentRunEvents.agentSlug, agentRunEvents.userId)
    .orderBy(desc(sql`max(${agentRunEvents.createdAt})`));

  if (rows.length === 0) return [];

  // Pull first user message + count per session in one query, raw SQL for the
  // jsonb extraction.
  const sessionIds = rows.map((r) => r.sessionId);
  const previews = await db.execute<{
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
    WHERE e.session_id = ANY(${sessionIds})
    GROUP BY e.session_id, e.app_name, e.user_id
  `);

  const previewMap = new Map<string, { firstMessage: string | null; messageCount: number }>();
  // drizzle-orm's `db.execute` returns differently across drivers; normalize.
  const previewRows: any[] = Array.isArray(previews) ? previews : (previews as any).rows ?? [];
  for (const row of previewRows) {
    previewMap.set(`${row.session_id}|${row.app_name}|${row.user_id}`, {
      firstMessage: row.first_message,
      messageCount: Number(row.message_count) || 0,
    });
  }

  return rows.map((r) => {
    const key = `${r.sessionId}|${r.agentSlug}|${r.adkUserId}`;
    const preview = previewMap.get(key);
    return {
      sessionId: r.sessionId,
      agentSlug: r.agentSlug,
      adkUserId: r.adkUserId,
      firstMessage: preview?.firstMessage ?? null,
      messageCount: preview?.messageCount ?? 0,
      startedAt: new Date(r.startedAt).toISOString(),
      lastActivityAt: new Date(r.lastActivityAt).toISOString(),
    };
  });
}

export type SessionTranscriptTurn = {
  author: 'user' | 'assistant';
  text: string;
  at: string;
};

export type SessionTranscript = {
  sessionId: string;
  agentSlug: string;
  turns: SessionTranscriptTurn[];
};

export async function getUserSessionTranscript(
  authedUserId: string,
  sessionId: string
): Promise<SessionTranscript | null> {
  const ownership = await db
    .select({ agentSlug: agentRunEvents.agentSlug, adkUserId: agentRunEvents.userId })
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

  const rows: any[] = Array.isArray(result) ? result : (result as any).rows ?? [];
  const turns: SessionTranscriptTurn[] = rows
    .filter((r) => r.text && r.text.trim().length > 0)
    .map((r) => ({
      author: r.author === 'user' ? 'user' : 'assistant',
      text: r.text as string,
      at: new Date(r.timestamp).toISOString(),
    }));

  return { sessionId, agentSlug, turns };
}
