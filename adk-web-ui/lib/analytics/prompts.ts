/**
 * The prompts people actually sent, for the ops Explorer's raw prompt list and
 * the Insights view.
 *
 * Source is the ADK-owned `events` table (`author='user'`, text in
 * `content->parts[].text`, read through `adk-events` so both ADK storage
 * layouts work). The catalog ships sample prompts and clicking one records it
 * verbatim, so those are told apart from organic prompts.
 *
 * (Unigram/bigram "theme" ranking used to live here. It was removed: on this
 * volume it mostly restated the raw list and nobody acted on it.)
 */

import { sql } from 'drizzle-orm';
import { db } from '@/lib/drizzle/db';
import { unwrapExecuteRows } from '@/lib/drizzle/unwrap-rows';
import snapshotJson from '@/lib/agent-catalog.snapshot.json';
import { adkEventsRelation, detectAdkEventsSchema, opsContentStart } from './adk-events';
import type { TimelineRange } from './timeline-range';

const MAX_PROMPT_ROWS = 5_000;

export type PromptRecord = {
  agentSlug: string;
  text: string;
};

/**
 * Collapses cosmetic differences so a suggestion click matches its catalog
 * entry: lowercase, whitespace runs collapsed, trailing punctuation dropped.
 */
export function normalizePromptText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?…]+$/, '');
}

type SnapshotAgent = { name: string; samplePrompts?: string[] };

let cachedSampleTexts: Set<string> | null = null;

/** Normalized sample prompts shipped in the catalog snapshot. */
export function catalogSamplePromptTexts(): Set<string> {
  if (cachedSampleTexts) return cachedSampleTexts;
  const snapshot = snapshotJson as { agents?: Array<string | SnapshotAgent> };
  const texts = new Set<string>();
  for (const entry of snapshot.agents ?? []) {
    if (typeof entry === 'string') continue;
    for (const prompt of entry.samplePrompts ?? []) {
      const normalized = normalizePromptText(String(prompt));
      if (normalized) texts.add(normalized);
    }
  }
  cachedSampleTexts = texts;
  return texts;
}

/**
 * Text-bearing user prompts. Function-call and artifact-only events yield no
 * text after extraction and are dropped. Works with either ADK storage layout.
 */
export async function fetchPromptRecords(
  range: TimelineRange,
  agentSlug?: string
): Promise<PromptRecord[]> {
  const schema = await detectAdkEventsSchema();
  if (!schema) return [];
  const start = opsContentStart(range);

  const rows = unwrapExecuteRows<{ app_name: string; text: string | null }>(
    await db.execute(sql`
      SELECT
        e.app_name,
        (
          SELECT string_agg(p->>'text', ' ')
          FROM jsonb_array_elements(CASE WHEN jsonb_typeof(e.content->'parts') = 'array' THEN e.content->'parts' ELSE '[]'::jsonb END) p
          WHERE p ? 'text' AND length(p->>'text') > 0
        ) AS text
      FROM ${adkEventsRelation(schema)} AS e
      WHERE e.author = 'user'
        AND e.content IS NOT NULL
        AND e.ts >= (${start.toISOString()})::timestamptz AT TIME ZONE 'UTC'
        ${agentSlug ? sql`AND e.app_name = ${agentSlug}` : sql``}
      ORDER BY e.ts DESC
      LIMIT ${MAX_PROMPT_ROWS}
    `)
  );

  return rows
    .filter((r): r is { app_name: string; text: string } => Boolean(r.text?.trim()))
    .map((r) => ({ agentSlug: r.app_name, text: r.text }));
}

export type RawPromptPage = {
  prompts: PromptRecord[];
  /** Total organic (non-sample) prompts before pagination — approximate. */
  total: number;
  offset: number;
  limit: number;
};

/**
 * Raw prompt texts for the ops Explorer. Sample catalog clicks are excluded.
 * Caps and pagination keep the payload bounded.
 */
export async function fetchRawPromptsPage(
  range: TimelineRange,
  options: { offset?: number; limit?: number; agentSlug?: string } = {}
): Promise<RawPromptPage> {
  const offset = Math.max(0, options.offset ?? 0);
  const limit = Math.min(100, Math.max(1, options.limit ?? 50));
  const all = await fetchPromptRecords(range, options.agentSlug);
  const sampleTexts = catalogSamplePromptTexts();
  const organic = all.filter(
    (p) => !sampleTexts.has(normalizePromptText(p.text))
  );
  return {
    prompts: organic.slice(offset, offset + limit),
    total: organic.length,
    offset,
    limit,
  };
}
