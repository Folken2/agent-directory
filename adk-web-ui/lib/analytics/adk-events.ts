/**
 * Read access to the ADK session store (the `sessions` and `events` tables
 * the ADK server writes into the same Postgres).
 *
 * ADK has two storage layouts. v0 (older databases) keeps `author`,
 * `content`, `error_code` and `usage_metadata` as columns; v1 keeps the whole
 * event as JSON in `event_data`. Which one a database uses depends on when it
 * was created, so every query here goes through {@link adkEventsRelation},
 * which exposes the same columns for both.
 */

import { sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/drizzle/db';
import { unwrapExecuteRows } from '@/lib/drizzle/unwrap-rows';
import { isAnalyticsDbAvailable } from './db-available';
import { timelineRangeDays, type TimelineRange } from './timeline-range';
import {
  BUILDER_APP,
  type BlueprintRecord,
  type ConversationRow,
  type ToolUsageRow,
  type TranscriptEntry,
} from './conversation-insights';

export type AdkEventsSchema = 'v0' | 'v1';

const SCHEMA_TTL_MS = 10 * 60 * 1000;
let schemaCache: { value: AdkEventsSchema | null; at: number } | null = null;
let submissionsCache: { value: boolean; at: number } | null = null;

/** Which ADK layout `events` uses, or null when there is no ADK store. */
export async function detectAdkEventsSchema(): Promise<AdkEventsSchema | null> {
  if (!isAnalyticsDbAvailable()) return null;
  if (schemaCache && Date.now() - schemaCache.at < SCHEMA_TTL_MS) return schemaCache.value;
  const rows = unwrapExecuteRows<{ column_name: string }>(
    await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'events'
        AND column_name IN ('author', 'event_data')
    `)
  );
  const columns = new Set(rows.map((r) => r.column_name));
  const value: AdkEventsSchema | null = columns.has('author') ? 'v0' : columns.has('event_data') ? 'v1' : null;
  schemaCache = { value, at: Date.now() };
  return value;
}

async function hasSubmissionsTable(): Promise<boolean> {
  if (submissionsCache && Date.now() - submissionsCache.at < SCHEMA_TTL_MS) return submissionsCache.value;
  const rows = unwrapExecuteRows<{ exists: boolean }>(
    await db.execute(sql`SELECT to_regclass('blueprint_submissions') IS NOT NULL AS exists`)
  );
  const value = Boolean(rows[0]?.exists);
  submissionsCache = { value, at: Date.now() };
  return value;
}

/**
 * Events as (app_name, user_id, session_id, author, ts, content, error_code,
 * usage) whichever layout the database uses. `content` and `usage` are jsonb
 * with ADK's snake_case keys in both layouts.
 */
export function adkEventsRelation(schema: AdkEventsSchema): SQL {
  if (schema === 'v0') {
    return sql`(SELECT app_name, user_id, session_id, author, "timestamp" AS ts,
      content::jsonb AS content, error_code, usage_metadata::jsonb AS usage FROM events)`;
  }
  return sql`(SELECT app_name, user_id, session_id, event_data::jsonb->>'author' AS author, "timestamp" AS ts,
    event_data::jsonb->'content' AS content, event_data::jsonb->>'error_code' AS error_code,
    event_data::jsonb->'usage_metadata' AS usage FROM events)`;
}

/** Start of the window as UTC midnight, or null for all time. */
export function rangeStart(range: TimelineRange, now: Date = new Date()): Date | null {
  const days = timelineRangeDays(range);
  if (days === null) return null;
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d;
}

/** ADK writes naive UTC timestamps; compare against a UTC wall-clock value. */
function sinceFilter(column: SQL, range: TimelineRange): SQL {
  const start = rangeStart(range);
  if (!start) return sql``;
  return sql`AND ${column} >= (${start.toISOString()})::timestamptz AT TIME ZONE 'UTC'`;
}

/** Message text, tool calls, from an event's `content.parts`. */
const PARTS = sql`(CASE WHEN jsonb_typeof(e.content->'parts') = 'array' THEN e.content->'parts' ELSE '[]'::jsonb END)`;

const MAX_PROMPT_CHARS = 500;
const MAX_PROMPTS_PER_CONVERSATION = 12;
export const MAX_CONVERSATIONS = 3000;

type ConversationSqlRow = {
  app_name: string;
  user_id: string;
  session_id: string;
  user_email: string | null;
  started_at: unknown;
  last_at: unknown;
  user_turns: unknown;
  agent_messages: unknown;
  tool_calls: unknown;
  errors: unknown;
  input_tokens: unknown;
  output_tokens: unknown;
  prompts: unknown;
  first_reply_ms: unknown;
  has_blueprint: boolean | null;
  saved: boolean | null;
};

function iso(value: unknown): string {
  if (!value) return '';
  // Naive timestamps arrive without a zone; they are UTC.
  const raw = value instanceof Date ? value.toISOString() : String(value);
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function textArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string' && value.startsWith('{')) {
    // Some drivers return Postgres arrays as their text form.
    try {
      return JSON.parse(`[${value.slice(1, -1)}]`);
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * One row per conversation with activity in the range, newest first: turn
 * counts, tool calls, errors, tokens, first-reply time, the user's messages,
 * and whether the builder produced (and the visitor saved) a blueprint.
 */
export async function fetchConversations(range: TimelineRange, limit = MAX_CONVERSATIONS): Promise<ConversationRow[]> {
  const schema = await detectAdkEventsSchema();
  if (!schema) return [];
  const saved = (await hasSubmissionsTable())
    ? sql`EXISTS (SELECT 1 FROM blueprint_submissions b WHERE b.session_id = c.session_id)`
    : sql`false`;

  const rows = unwrapExecuteRows<ConversationSqlRow>(
    await db.execute(sql`
      WITH e AS (
        SELECT * FROM ${adkEventsRelation(schema)} AS raw
        WHERE TRUE ${sinceFilter(sql`raw.ts`, range)}
      ),
      per_event AS (
        SELECT e.app_name, e.user_id, e.session_id, e.author, e.ts, e.error_code,
          COALESCE((e.usage->>'prompt_token_count')::bigint, 0) AS in_tok,
          COALESCE((e.usage->>'candidates_token_count')::bigint, 0) AS out_tok,
          (SELECT string_agg(p->>'text', ' ') FROM jsonb_array_elements(${PARTS}) p
            WHERE p ? 'text' AND length(p->>'text') > 0) AS text,
          (SELECT count(*) FROM jsonb_array_elements(${PARTS}) p WHERE p ? 'function_call') AS calls
        FROM e
      ),
      c AS (
        SELECT app_name, user_id, session_id,
          min(ts) AS started_at,
          max(ts) AS last_at,
          count(*) FILTER (WHERE author = 'user' AND text IS NOT NULL) AS user_turns,
          count(*) FILTER (WHERE author <> 'user' AND text IS NOT NULL) AS agent_messages,
          COALESCE(sum(calls), 0) AS tool_calls,
          count(*) FILTER (WHERE error_code IS NOT NULL) AS errors,
          sum(in_tok) AS input_tokens,
          sum(out_tok) AS output_tokens,
          (array_agg(left(text, ${sql.raw(String(MAX_PROMPT_CHARS))}) ORDER BY ts)
            FILTER (WHERE author = 'user' AND text IS NOT NULL))[1:${sql.raw(String(MAX_PROMPTS_PER_CONVERSATION))}] AS prompts,
          min(ts) FILTER (WHERE author = 'user' AND text IS NOT NULL) AS first_user_at,
          min(ts) FILTER (WHERE author <> 'user' AND (text IS NOT NULL OR calls > 0 OR error_code IS NOT NULL)) AS first_agent_at
        FROM per_event
        GROUP BY app_name, user_id, session_id
        HAVING count(*) FILTER (WHERE author = 'user' AND text IS NOT NULL) > 0
        ORDER BY max(ts) DESC
        LIMIT ${limit}
      )
      SELECT c.app_name, c.user_id, c.session_id, u.email AS user_email,
        c.started_at, c.last_at, c.user_turns, c.agent_messages, c.tool_calls, c.errors,
        c.input_tokens, c.output_tokens, c.prompts,
        CASE WHEN c.first_agent_at >= c.first_user_at
          THEN (EXTRACT(EPOCH FROM (c.first_agent_at - c.first_user_at)) * 1000)::bigint END AS first_reply_ms,
        (s.state::jsonb ? 'blueprint:document') AS has_blueprint,
        ${saved} AS saved
      FROM c
      LEFT JOIN sessions s ON s.app_name = c.app_name AND s.user_id = c.user_id AND s.id = c.session_id
      LEFT JOIN users u ON c.user_id = 'u_' || u.id::text
      ORDER BY c.last_at DESC
    `)
  );

  return rows.map((r) => ({
    appName: String(r.app_name),
    userId: String(r.user_id),
    sessionId: String(r.session_id),
    userEmail: r.user_email ? String(r.user_email) : null,
    startedAt: iso(r.started_at),
    lastAt: iso(r.last_at),
    userTurns: num(r.user_turns),
    agentMessages: num(r.agent_messages),
    toolCalls: num(r.tool_calls),
    errors: num(r.errors),
    inputTokens: num(r.input_tokens),
    outputTokens: num(r.output_tokens),
    prompts: textArray(r.prompts),
    firstReplyMs: r.first_reply_ms === null || r.first_reply_ms === undefined ? null : num(r.first_reply_ms),
    hasBlueprint: Boolean(r.has_blueprint),
    saved: Boolean(r.saved),
  }));
}

/** Tool calls the agents made in the range, most used first. */
export async function fetchToolUsage(range: TimelineRange): Promise<ToolUsageRow[]> {
  const schema = await detectAdkEventsSchema();
  if (!schema) return [];
  const rows = unwrapExecuteRows<{ app_name: string; tool: string; calls: unknown; conversations: unknown }>(
    await db.execute(sql`
      SELECT e.app_name, p->'function_call'->>'name' AS tool,
        count(*) AS calls, count(DISTINCT e.session_id) AS conversations
      FROM ${adkEventsRelation(schema)} AS e, jsonb_array_elements(${PARTS}) p
      WHERE p ? 'function_call' ${sinceFilter(sql`e.ts`, range)}
      GROUP BY 1, 2
      ORDER BY calls DESC
      LIMIT 50
    `)
  );
  return rows
    .filter((r) => r.tool)
    .map((r) => ({ agentSlug: String(r.app_name), tool: String(r.tool), calls: num(r.calls), conversations: num(r.conversations) }));
}

/** Builder sessions whose state holds a blueprint, updated in the range. */
export async function fetchBuilderBlueprints(range: TimelineRange): Promise<BlueprintRecord[]> {
  const schema = await detectAdkEventsSchema();
  if (!schema) return [];
  const saved = (await hasSubmissionsTable())
    ? sql`EXISTS (SELECT 1 FROM blueprint_submissions b WHERE b.session_id = s.id)`
    : sql`false`;
  const rows = unwrapExecuteRows<{ id: string; user_id: string; update_time: unknown; saved: boolean; doc: unknown }>(
    await db.execute(sql`
      SELECT s.id, s.user_id, s.update_time, ${saved} AS saved, s.state::jsonb->'blueprint:document' AS doc
      FROM sessions s
      WHERE s.app_name = ${BUILDER_APP} AND s.state::jsonb ? 'blueprint:document'
        ${sinceFilter(sql`s.update_time`, range)}
      ORDER BY s.update_time DESC
      LIMIT 1000
    `)
  );
  return rows.map((r) => ({
    sessionId: String(r.id),
    userId: String(r.user_id),
    updatedAt: iso(r.update_time),
    saved: Boolean(r.saved),
    doc: typeof r.doc === 'string' ? safeJson(r.doc) : r.doc,
  }));
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Every event of one conversation, oldest first, for the ops transcript view.
 * Looked up by agent and session id so the page never needs the visitor's
 * ADK user id (for anonymous visitors that is their rate-limit token).
 */
export async function fetchTranscript(appName: string, sessionId: string): Promise<TranscriptEntry[]> {
  const schema = await detectAdkEventsSchema();
  if (!schema) return [];
  const rows = unwrapExecuteRows<{
    author: string;
    ts: unknown;
    text: string | null;
    calls: unknown;
    results: unknown;
    error_code: string | null;
  }>(
    await db.execute(sql`
      SELECT e.author, e.ts, e.error_code,
        (SELECT string_agg(p->>'text', E'\n') FROM jsonb_array_elements(${PARTS}) p
          WHERE p ? 'text' AND length(p->>'text') > 0) AS text,
        (SELECT array_agg(p->'function_call'->>'name') FROM jsonb_array_elements(${PARTS}) p
          WHERE p ? 'function_call') AS calls,
        (SELECT array_agg(p->'function_response'->>'name') FROM jsonb_array_elements(${PARTS}) p
          WHERE p ? 'function_response') AS results
      FROM ${adkEventsRelation(schema)} AS e
      WHERE e.app_name = ${appName} AND e.session_id = ${sessionId}
      ORDER BY e.ts ASC
      LIMIT 500
    `)
  );
  return rows.map((r) => ({
    author: String(r.author ?? ''),
    at: iso(r.ts),
    text: r.text ?? null,
    toolCalls: textArray(r.calls).filter(Boolean),
    toolResults: textArray(r.results).filter(Boolean),
    error: r.error_code ?? null,
  }));
}
