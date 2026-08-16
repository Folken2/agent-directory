/**
 * Map Neon rows of signed-in accounts + usage onto the ops Users table.
 * Query lives in ops-queries; this file stays DB-free so unit tests can cover
 * timestamp / slug / count coercion without standing up Postgres.
 */

import type { SignedInUserRow } from './ops-types';

export type SignedInUserSqlRow = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  created_at: unknown;
  page_views: unknown;
  runs: unknown;
  errors: unknown;
  agents_used: unknown;
  agent_slugs: unknown;
  last_run_at: unknown;
  last_view_at: unknown;
};

function toIso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toCount(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function laterIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

export function parseAgentSlugs(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value !== 'string' || value.trim() === '') return [];
  return value
    .split(',')
    .map((slug) => slug.trim())
    .filter(Boolean);
}

export function toSignedInUserRow(raw: SignedInUserSqlRow): SignedInUserRow {
  const lastRunAt = toIso(raw.last_run_at);
  const lastViewAt = toIso(raw.last_view_at);
  return {
    id: String(raw.id),
    email: String(raw.email ?? ''),
    name: String(raw.name ?? ''),
    image: raw.image ? String(raw.image) : null,
    signedUpAt: toIso(raw.created_at) ?? '',
    pageViews: toCount(raw.page_views),
    runs: toCount(raw.runs),
    errors: toCount(raw.errors),
    agentsUsed: toCount(raw.agents_used),
    agentSlugs: parseAgentSlugs(raw.agent_slugs),
    lastRunAt,
    lastViewAt,
    lastActiveAt: laterIso(lastRunAt, lastViewAt),
  };
}
