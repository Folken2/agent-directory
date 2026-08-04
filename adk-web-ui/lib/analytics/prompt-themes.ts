/**
 * Turns the prompts people actually sent into ranked themes — the closest thing
 * we have to "what are people trying to do here".
 *
 * Source is the ADK-owned `events` table (`author='user'`, text in
 * `content->parts[].text`), which holds 8 months of history. No new tracking was
 * added for this; see the design doc.
 *
 * Deliberately dumb: frequency counting over unigrams and bigrams. No model, no
 * clustering. Word segmentation goes through `Intl.Segmenter` because real
 * prompts are not all ASCII — recorded prompts include Chinese text, which a
 * whitespace split would collapse into one meaningless token.
 *
 * Two corrections keep this from lying, both found by running it on real data:
 *
 *  1. The agent catalog ships 37 sample prompts, and clicking one records it
 *     verbatim. Uncorrected, the top "themes" were simply the sample prompts
 *     ("build simple searches web summarizes results", 20 hits).
 *  2. Identical prompts recur — suggestion clicks and repeated testing. Themes
 *     count *distinct* prompt texts, so one prompt sent nine times is one piece
 *     of demand, not nine.
 */

import { sql } from 'drizzle-orm';
import { db } from '@/lib/drizzle/db';
import { unwrapExecuteRows } from '@/lib/drizzle/unwrap-rows';
import snapshotJson from '@/lib/agent-catalog.snapshot.json';
import { isAnalyticsDbAvailable } from './db-available';
import { timelineRangeDays, type TimelineRange } from './timeline-range';

/** Prompts longer than this are truncated before tokenizing — pasted code and
 * logs would otherwise dominate the counts. */
export const MAX_PROMPT_CHARS = 2_000;
const MAX_PROMPT_ROWS = 5_000;

/** A term must appear in at least this many *distinct* prompts to rank. */
export const MIN_THEME_PROMPTS = 2;

export type PromptTheme = {
  term: string;
  /** Distinct prompts containing the term, not raw occurrences. */
  prompts: number;
  /** Agents where the term appeared, most frequent first. */
  agents: { agentSlug: string; prompts: number }[];
};

export type PromptThemes = {
  /** Every text-bearing user prompt in range. */
  totalPrompts: number;
  /** Prompts matching a catalog sample verbatim — a click, not a question. */
  samplePrompts: number;
  /** totalPrompts minus samplePrompts. */
  organicPrompts: number;
  /** Distinct organic prompt texts. Themes are counted over these. */
  distinctOrganicPrompts: number;
  unigrams: PromptTheme[];
  bigrams: PromptTheme[];
};

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
 * Words carrying no signal here. Beyond ordinary stopwords this includes terms
 * that are constant across a directory of AI agents ("agent", "please", "make"),
 * which would otherwise top every list and say nothing.
 */
const STOPWORDS = new Set([
  // English function words
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'than', 'that', 'this',
  'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
  'do', 'does', 'did', 'doing', 'have', 'has', 'had', 'having', 'will', 'would',
  'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'to', 'of', 'in',
  'on', 'at', 'by', 'for', 'with', 'about', 'into', 'from', 'up', 'down', 'out',
  'over', 'under', 'again', 'as', 'it', 'its', 'i', 'me', 'my', 'we', 'our',
  'you', 'your', 'he', 'she', 'they', 'them', 'their', 'what', 'which', 'who',
  'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'more', 'most',
  'other', 'some', 'such', 'no', 'not', 'only', 'own', 'same', 'so', 'too',
  'very', 'just', 'now', 'also', 'there', 'here',
  // Spanish and other locales appear in real traffic
  'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'que', 'por', 'para',
  'con', 'como', 'es', 'en', 'y', 'o', 'se', 'lo', 'al',
  // Constant across this product — true of every prompt, so no signal
  'please', 'thanks', 'thank', 'hi', 'hello', 'hey', 'ok', 'okay', 'yes',
  'agent', 'agents', 'want', 'need', 'like', 'let', 'get', 'give', 'make',
  'help', 'use', 'using', 'try', 'add', 'show', 'tell', 'find',
]);

const LATIN_RE = /[a-z]/;

let segmenter: Intl.Segmenter | null | undefined;

function wordSegmenter(): Intl.Segmenter | null {
  if (segmenter === undefined) {
    try {
      segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
    } catch {
      segmenter = null;
    }
  }
  return segmenter;
}

function isMeaningfulToken(token: string): boolean {
  if (!token) return false;
  if (STOPWORDS.has(token)) return false;
  if (/^\d+$/.test(token)) return false;
  // Single characters carry no signal in Latin scripts; in CJK they often do,
  // and bigrams cover the rest.
  if (token.length < 2 && LATIN_RE.test(token)) return false;
  return true;
}

/**
 * Splits prompt text into normalized word-like tokens. URLs and code fences are
 * dropped first — they are noise, and URLs would leak identifiers into themes.
 */
export function tokenizePrompt(rawText: string): string[] {
  const text = rawText
    .slice(0, MAX_PROMPT_CHARS)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, ' ')
    .toLowerCase();

  const seg = wordSegmenter();
  const tokens: string[] = [];

  if (seg) {
    for (const part of seg.segment(text)) {
      if (!part.isWordLike) continue;
      const token = part.segment.trim();
      if (isMeaningfulToken(token)) tokens.push(token);
    }
    return tokens;
  }

  // Environments without Intl.Segmenter: whitespace fallback. Loses CJK
  // granularity but never throws.
  for (const candidate of text.split(/[^\p{L}\p{N}]+/u)) {
    const token = candidate.trim();
    if (isMeaningfulToken(token)) tokens.push(token);
  }
  return tokens;
}

type Counter = Map<string, { prompts: number; byAgent: Map<string, number> }>;

/**
 * Records one distinct prompt containing `term`. `prompts` counts the prompt
 * once even when it was sent to several agents; `byAgent` credits each.
 */
function bump(counter: Counter, term: string, agentSlugs: readonly string[]): void {
  let row = counter.get(term);
  if (!row) {
    row = { prompts: 0, byAgent: new Map() };
    counter.set(term, row);
  }
  row.prompts++;
  for (const slug of agentSlugs) {
    row.byAgent.set(slug, (row.byAgent.get(slug) ?? 0) + 1);
  }
}

function toThemes(counter: Counter, minPrompts: number, topN: number): PromptTheme[] {
  return [...counter.entries()]
    .filter(([, row]) => row.prompts >= minPrompts)
    .sort((a, b) => b[1].prompts - a[1].prompts || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([term, row]) => ({
      term,
      prompts: row.prompts,
      agents: [...row.byAgent.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([agentSlug, prompts]) => ({ agentSlug, prompts })),
    }));
}

/**
 * Ranks themes over distinct organic prompt texts.
 *
 * Sample prompts are excluded and duplicates collapsed, because both represent
 * one act rather than many: without this the ranking just recites the catalog's
 * own suggestions back at you.
 *
 * Within a prompt, a term counts once however often it repeats, so one rambling
 * message cannot invent a theme.
 *
 * Unigrams and bigrams are returned separately rather than merged: a bigram is
 * always rarer than its parts, so a single ranking would bury every phrase.
 */
export function rankPromptThemes(
  prompts: readonly PromptRecord[],
  options: {
    minPrompts?: number;
    topN?: number;
    /** Normalized sample texts to exclude. Pass an empty set to keep them. */
    samplePromptTexts?: Set<string>;
  } = {}
): PromptThemes {
  const minPrompts = options.minPrompts ?? MIN_THEME_PROMPTS;
  const topN = options.topN ?? 25;
  const sampleTexts = options.samplePromptTexts ?? catalogSamplePromptTexts();

  let samplePrompts = 0;
  // Distinct organic text → the agents it was sent to.
  const distinct = new Map<string, { text: string; agents: Set<string> }>();

  for (const prompt of prompts) {
    const normalized = normalizePromptText(prompt.text);
    if (!normalized) continue;
    if (sampleTexts.has(normalized)) {
      samplePrompts++;
      continue;
    }
    // Drop prompts that are only stopwords / punctuation — they are not demand.
    if (tokenizePrompt(prompt.text).length === 0) continue;
    const existing = distinct.get(normalized);
    if (existing) {
      existing.agents.add(prompt.agentSlug);
    } else {
      distinct.set(normalized, {
        text: prompt.text,
        agents: new Set([prompt.agentSlug]),
      });
    }
  }

  const unigrams: Counter = new Map();
  const bigrams: Counter = new Map();

  for (const entry of distinct.values()) {
    const tokens = tokenizePrompt(entry.text);
    if (tokens.length === 0) continue;
    // A prompt sent to several agents is credited to each, but counted once.
    const agents = [...entry.agents];

    for (const term of new Set(tokens)) {
      bump(unigrams, term, agents);
    }

    const phrases = new Set<string>();
    for (let i = 0; i < tokens.length - 1; i++) {
      phrases.add(`${tokens[i]} ${tokens[i + 1]}`);
    }
    for (const phrase of phrases) {
      bump(bigrams, phrase, agents);
    }
  }

  return {
    totalPrompts: prompts.length,
    samplePrompts,
    organicPrompts: prompts.length - samplePrompts,
    distinctOrganicPrompts: distinct.size,
    unigrams: toThemes(unigrams, minPrompts, topN),
    bigrams: toThemes(bigrams, minPrompts, topN),
  };
}

// ---------------------------------------------------------------------------
// Database access
// ---------------------------------------------------------------------------

function sinceClause(range: TimelineRange) {
  const days = timelineRangeDays(range);
  if (days === null) return sql``;
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return sql`AND timestamp >= (${d.toISOString()})::timestamptz AT TIME ZONE 'UTC'`;
}

/**
 * Text-bearing user prompts. Function-call and artifact-only events yield no
 * text after extraction and are dropped.
 */
export async function fetchPromptRecords(
  range: TimelineRange,
  agentSlug?: string
): Promise<PromptRecord[]> {
  if (!isAnalyticsDbAvailable()) return [];

  const rows = unwrapExecuteRows<{ app_name: string; text: string | null }>(
    await db.execute(sql`
      SELECT
        app_name,
        (
          SELECT string_agg(p->>'text', ' ')
          FROM jsonb_array_elements(content->'parts') p
          WHERE p ? 'text' AND length(p->>'text') > 0
        ) AS text
      FROM events
      WHERE author = 'user'
        AND content IS NOT NULL
        ${sinceClause(range)}
        ${agentSlug ? sql`AND app_name = ${agentSlug}` : sql``}
      ORDER BY timestamp DESC
      LIMIT ${MAX_PROMPT_ROWS}
    `)
  );

  return rows
    .filter((r): r is { app_name: string; text: string } => Boolean(r.text?.trim()))
    .map((r) => ({ agentSlug: r.app_name, text: r.text }));
}

export async function fetchPromptThemes(
  range: TimelineRange,
  options: { minPrompts?: number; topN?: number } = {}
): Promise<PromptThemes> {
  return rankPromptThemes(await fetchPromptRecords(range), options);
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
