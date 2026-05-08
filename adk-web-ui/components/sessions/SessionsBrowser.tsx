'use client';

/**
 * Client-side browser for /me/sessions.
 *
 * Owns two pieces of UI state on top of the server-fetched session list:
 *   - selectedSlugs — agent quick-filter chips (multi-select; empty = all)
 *   - query — full-text search across the first user message of each session
 *
 * Filtering is in-memory and synchronous: the user's session list is bounded
 * (a few dozen at most for any real user) so debouncing or server-side
 * search isn't worth the complexity. If that changes, the search side moves
 * to /api/me/sessions?q=… and the chip side stays here.
 *
 * The component preserves the same visual treatment as the original
 * server-only page (cards, date bands, agent logo / colored avatar). The
 * page-level header now reacts to filters: it shows "X of Y conversations"
 * whenever the visible set differs from the full set.
 */

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search, X, ArrowRight, MessageSquare, Sparkles } from 'lucide-react';
import type { ChatSessionSummary } from '@/lib/sessions';
import type { AgentMetadata } from '@/lib/agent-metadata';
import { formatAgentDisplayName } from '@/lib/agent-utils';
import { getCategoryColors } from '@/lib/category-colors';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Date bucketing
// ---------------------------------------------------------------------------

type DateBand = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'earlier';

const BAND_LABELS: Record<DateBand, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'Earlier this week',
  thisMonth: 'Earlier this month',
  earlier: 'Earlier',
};

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function bandFor(iso: string): DateBand {
  const ts = new Date(iso).getTime();
  const todayStart = startOfDay(new Date()).getTime();
  const yesterdayStart = todayStart - 86_400_000;
  const sevenDaysAgo = todayStart - 7 * 86_400_000;
  const thirtyDaysAgo = todayStart - 30 * 86_400_000;
  if (ts >= todayStart) return 'today';
  if (ts >= yesterdayStart) return 'yesterday';
  if (ts >= sevenDaysAgo) return 'thisWeek';
  if (ts >= thirtyDaysAgo) return 'thisMonth';
  return 'earlier';
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function truncate(s: string | null, max = 220): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max).trimEnd() + '…' : s;
}

const AVATAR_PALETTE = [
  'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300',
];
function colorForSlug(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function initialFor(slug: string, displayName: string): string {
  const source = displayName || formatAgentDisplayName(slug);
  return source.charAt(0).toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface SessionsBrowserProps {
  sessions: ChatSessionSummary[];
  /**
   * Agent metadata keyed by agent slug. Plain object (not Map) so it
   * crosses the server→client boundary cleanly. Nullable values mean
   * "metadata file missing"; the card will fall back to the colored avatar.
   */
  agentMetadata: Record<string, AgentMetadata | null>;
}

export default function SessionsBrowser({
  sessions,
  agentMetadata,
}: SessionsBrowserProps) {
  const [query, setQuery] = useState('');
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());

  // Per-agent counts for the chip row, computed from the unfiltered set so
  // chips don't shrink when you start filtering.
  const agentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sessions) counts.set(s.agentSlug, (counts.get(s.agentSlug) ?? 0) + 1);
    // Sort by count desc, then by display name asc.
    return Array.from(counts.entries())
      .map(([slug, count]) => ({
        slug,
        count,
        displayName: agentMetadata[slug]?.displayName || formatAgentDisplayName(slug),
      }))
      .sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName));
  }, [sessions, agentMetadata]);

  const filteredSessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((s) => {
      if (selectedSlugs.size > 0 && !selectedSlugs.has(s.agentSlug)) return false;
      if (q && !(s.firstMessage ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sessions, selectedSlugs, query]);

  const isFiltered = selectedSlugs.size > 0 || query.trim().length > 0;

  const toggleSlug = (slug: string) => {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const clearAll = () => {
    setSelectedSlugs(new Set());
    setQuery('');
  };

  // --- Render -----------------------------------------------------------

  if (sessions.length === 0) {
    return (
      <>
        <PageHeader total={0} visible={0} agentCount={0} lastActivity={undefined} />
        <EmptyState />
      </>
    );
  }

  return (
    <>
      <PageHeader
        total={sessions.length}
        visible={filteredSessions.length}
        agentCount={agentCounts.length}
        lastActivity={sessions[0]?.lastActivityAt}
        isFiltered={isFiltered}
      />

      <div className="mb-8 space-y-4">
        <FilterChips
          chips={agentCounts}
          selected={selectedSlugs}
          onToggle={toggleSlug}
          onClear={() => setSelectedSlugs(new Set())}
        />

        <SearchBar query={query} onChange={setQuery} />
      </div>

      {filteredSessions.length === 0 ? (
        <NoMatchState onClear={clearAll} />
      ) : (
        <SessionsList sessions={filteredSessions} agentMetadata={agentMetadata} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function PageHeader({
  total,
  visible,
  agentCount,
  lastActivity,
  isFiltered = false,
}: {
  total: number;
  visible: number;
  agentCount: number;
  lastActivity: string | undefined;
  isFiltered?: boolean;
}) {
  return (
    <header className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-xl bg-md-primary-container/40 text-md-on-primary-container flex items-center justify-center">
          <MessageSquare className="w-4 h-4" />
        </div>
        <div className="text-label-small text-md-on-surface-variant/70 uppercase tracking-widest">
          Your sessions
        </div>
      </div>

      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-md-on-surface">
        {total === 0
          ? 'No conversations yet'
          : isFiltered
            ? `${visible} of ${total} ${total === 1 ? 'conversation' : 'conversations'}`
            : `${total} ${total === 1 ? 'conversation' : 'conversations'}`}
      </h1>

      {total > 0 && (
        <p className="mt-2 text-md-on-surface-variant text-body-large">
          Across {agentCount} {agentCount === 1 ? 'agent' : 'agents'}
          {lastActivity && (
            <>
              {' '}· last activity{' '}
              <span className="text-md-on-surface">{relativeTime(lastActivity)}</span>
            </>
          )}
        </p>
      )}
    </header>
  );
}

function FilterChips({
  chips,
  selected,
  onToggle,
  onClear,
}: {
  chips: Array<{ slug: string; count: number; displayName: string }>;
  selected: Set<string>;
  onToggle: (slug: string) => void;
  onClear: () => void;
}) {
  if (chips.length <= 1) return null; // nothing to filter against
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onClear}
        className={cn(
          'px-3 py-1.5 rounded-full text-label-small font-medium border transition-colors',
          selected.size === 0
            ? 'bg-md-on-surface text-md-surface border-md-on-surface'
            : 'bg-transparent text-md-on-surface-variant border-md-outline/60 hover:border-md-on-surface hover:text-md-on-surface',
        )}
      >
        All
      </button>
      {chips.map((chip) => {
        const active = selected.has(chip.slug);
        return (
          <button
            key={chip.slug}
            type="button"
            onClick={() => onToggle(chip.slug)}
            className={cn(
              'px-3 py-1.5 rounded-full text-label-small font-medium border inline-flex items-center gap-1.5 transition-colors',
              active
                ? 'bg-md-on-surface text-md-surface border-md-on-surface'
                : 'bg-transparent text-md-on-surface-variant border-md-outline/60 hover:border-md-on-surface hover:text-md-on-surface',
            )}
          >
            {chip.displayName}
            <span
              className={cn(
                'tabular-nums text-[10px] rounded-full px-1.5 py-px',
                active
                  ? 'bg-md-surface/20 text-md-surface'
                  : 'bg-md-surface-container/80 text-md-on-surface-variant/80',
              )}
            >
              {chip.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SearchBar({ query, onChange }: { query: string; onChange: (q: string) => void }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-md-on-surface-variant/60 pointer-events-none" />
      <input
        type="search"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search past messages…"
        className="w-full h-11 pl-9 pr-9 rounded-xl bg-md-surface-container/40 border border-md-outline/40 text-body-medium text-md-on-surface placeholder:text-md-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-md-primary/30 focus:border-md-primary/40 transition-colors"
      />
      {query.length > 0 && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 inline-flex items-center justify-center rounded-md text-md-on-surface-variant hover:bg-md-surface-container hover:text-md-on-surface transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function NoMatchState({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-2xl border border-md-outline/40 bg-md-surface-container/30 p-10 text-center">
      <div className="w-12 h-12 mx-auto rounded-2xl bg-md-surface-container text-md-on-surface-variant flex items-center justify-center mb-5">
        <Search className="w-5 h-5" />
      </div>
      <h2 className="text-title-medium text-md-on-surface mb-2">No sessions match</h2>
      <p className="text-body-small text-md-on-surface-variant mb-5">
        Try a different search or clear your filters.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-label-medium font-medium border border-md-outline/60 text-md-on-surface hover:bg-md-surface-container transition-colors"
      >
        Clear all
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-md-outline/40 bg-md-surface-container/30 p-10 sm:p-14 text-center">
      <div className="w-12 h-12 mx-auto rounded-2xl bg-md-primary-container/40 text-md-on-primary-container flex items-center justify-center mb-5">
        <Sparkles className="w-5 h-5" />
      </div>
      <h2 className="text-title-large text-md-on-surface mb-2">
        Start a chat to see it here
      </h2>
      <p className="text-body-medium text-md-on-surface-variant max-w-sm mx-auto mb-6">
        Once you&apos;ve had a conversation with any agent, it&apos;ll show up on
        this page so you can pick up where you left off.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-label-medium font-medium bg-md-primary text-md-on-primary hover:opacity-90 transition-opacity"
      >
        Browse agents
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

function SessionsList({
  sessions,
  agentMetadata,
}: {
  sessions: ChatSessionSummary[];
  agentMetadata: Record<string, AgentMetadata | null>;
}) {
  const bands: Record<DateBand, ChatSessionSummary[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    thisMonth: [],
    earlier: [],
  };
  for (const s of sessions) bands[bandFor(s.lastActivityAt)].push(s);
  const orderedBands: DateBand[] = ['today', 'yesterday', 'thisWeek', 'thisMonth', 'earlier'];

  return (
    <div className="space-y-10">
      {orderedBands.map((band) => {
        const items = bands[band];
        if (items.length === 0) return null;
        return (
          <section key={band}>
            <h2 className="text-label-small text-md-on-surface-variant/70 uppercase tracking-widest mb-3">
              {BAND_LABELS[band]}
            </h2>
            <div className="space-y-2.5">
              {items.map((s) => (
                <SessionCard
                  key={s.sessionId}
                  session={s}
                  meta={agentMetadata[s.agentSlug] ?? null}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SessionCard({
  session,
  meta,
}: {
  session: ChatSessionSummary;
  meta: AgentMetadata | null;
}) {
  const displayName = meta?.displayName || formatAgentDisplayName(session.agentSlug);
  const categoryColors = getCategoryColors(meta?.category);

  return (
    <Link
      href={`/chat?agent=${encodeURIComponent(session.agentSlug)}&session=${encodeURIComponent(session.sessionId)}`}
      className="group block rounded-2xl border border-md-outline/40 bg-md-surface hover:border-md-primary/40 hover:shadow-elevation-2 transition-all duration-200 hover:-translate-y-0.5 overflow-hidden"
    >
      <div className="p-5 sm:p-6 flex gap-4">
        {/* Avatar / logo */}
        <div className="shrink-0">
          {meta?.logo ? (
            <div className="w-11 h-11 rounded-xl bg-md-surface-container border border-md-outline-variant/50 flex items-center justify-center overflow-hidden p-1.5">
              <img
                src={meta.logo}
                alt=""
                className="object-contain w-full h-full"
              />
            </div>
          ) : (
            <div
              className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center text-base font-semibold',
                colorForSlug(session.agentSlug),
              )}
              aria-hidden="true"
            >
              {initialFor(session.agentSlug, displayName)}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <div className="min-w-0 flex items-center gap-2">
              <h3 className="text-title-small text-md-on-surface tracking-tight truncate">
                {displayName}
              </h3>
              {meta?.category && (
                <span
                  className={cn(
                    'shrink-0 inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border tracking-wide uppercase',
                    categoryColors.bg,
                    categoryColors.text,
                    categoryColors.border,
                  )}
                >
                  {meta.category}
                </span>
              )}
            </div>
            <span className="shrink-0 text-label-small text-md-on-surface-variant/70 tabular-nums">
              {relativeTime(session.lastActivityAt)}
            </span>
          </div>

          <p className="text-body-medium text-md-on-surface-variant leading-relaxed line-clamp-2">
            {truncate(session.firstMessage) || (
              <span className="italic text-md-on-surface-variant/60">No text content</span>
            )}
          </p>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-label-small text-md-on-surface-variant/70">
              {session.messageCount} {session.messageCount === 1 ? 'message' : 'messages'}
            </span>
            <span className="inline-flex items-center gap-1 text-label-small text-md-on-surface-variant/0 group-hover:text-md-primary transition-colors">
              Resume <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
