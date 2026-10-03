import { formatAgentDisplayName } from '../agent-utils';

/** One ranked row on the dashboard (pages, sources, devices). */
export type RankedStat = { id: string; label: string; count: number; share: number };

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Home',
  '/examples': 'Examples',
  '/chat': 'Chat',
  '/about': 'About',
  '/analytics': 'Analytics',
  '/me/sessions': 'Sessions',
  '/auth/signin': 'Sign in',
};

/** Human label for a normalized path. */
export function pageLabel(path: string): string {
  if (ROUTE_LABELS[path]) return ROUTE_LABELS[path];
  const agent = /^\/agents\/([^/]+)$/.exec(path);
  if (agent) return `Agent: ${formatAgentDisplayName(decodeURIComponent(agent[1]))}`;
  return path;
}

const DIRECT = { id: 'direct', label: 'Direct / none' };

/** Referrer URL → source host; empty, unparseable and same-site referrers are "direct". */
export function referrerSource(referrer: string | null | undefined, ownHosts: string[]): { id: string; label: string } {
  if (!referrer) return DIRECT;
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return DIRECT;
  }
  host = host.replace(/^www\./, '');
  if (!host || ownHosts.some((own) => host === own || host.endsWith(`.${own}`))) return DIRECT;
  return { id: host, label: host };
}

/** Percent change vs the previous period; null when there is no baseline. */
export function deltaPct(current: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Clean y-axis ticks (1/2/5 × 10^n steps) from 0 to at least `max`. */
export function niceTicks(max: number, target = 5): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/** Sort by count, keep the top `limit`, fold the rest into "Other"; shares are % of the total. */
export function rankShares(rows: Array<{ id: string; label: string; count: number }>, limit: number): RankedStat[] {
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (total <= 0) return [];
  const share = (n: number) => Math.round((n / total) * 1000) / 10;
  const sorted = [...rows].filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
  const head = sorted.slice(0, limit).map((r) => ({ ...r, share: share(r.count) }));
  const rest = sorted.slice(limit).reduce((s, r) => s + r.count, 0);
  return rest > 0 ? [...head, { id: 'other', label: 'Other', count: rest, share: share(rest) }] : head;
}

/** 850 ms, 12.4 s, 2m 05s. */
export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}m ${String(totalSeconds % 60).padStart(2, '0')}s`;
}

/** "just now", "5 min ago", "3 h ago", "2 d ago", then a short date. */
export function formatAgo(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const minutes = Math.floor((now.getTime() - t) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
