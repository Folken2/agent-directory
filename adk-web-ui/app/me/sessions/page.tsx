import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { listSessionsForUser, type ChatSessionSummary } from '@/lib/sessions';
import { loadAgentMetadata, type AgentMetadata } from '@/lib/agent-metadata';
import { formatAgentDisplayName } from '@/lib/agent-utils';
import { getCategoryColors } from '@/lib/category-colors';
import { cn } from '@/lib/utils';
import { ArrowRight, MessageSquare, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Your sessions',
  robots: { index: false, follow: false },
};

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

// Stable color from a slug for the avatar fallback when an agent has no logo.
// Picks from a small palette so the page stays visually coherent.
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
// Page
// ---------------------------------------------------------------------------

export default async function MySessionsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/me/sessions');
  }

  if (!process.env.DATABASE_URL) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Your sessions</h1>
        <p className="mt-3 text-md-on-surface-variant">
          Database isn&apos;t configured, so we can&apos;t show your past chats.
        </p>
      </div>
    );
  }

  const sessions = await listSessionsForUser(session.user.id);

  // Load agent metadata once per unique slug so cards can show logos +
  // category colors. listSessionsForUser already returns sessions sorted
  // newest-first, so sessions[0] is the most recent.
  const uniqueSlugs = Array.from(new Set(sessions.map((s) => s.agentSlug)));
  const metaBySlug = new Map<string, AgentMetadata | null>();
  for (const slug of uniqueSlugs) {
    metaBySlug.set(slug, loadAgentMetadata(slug));
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <PageHeader sessions={sessions} agentCount={uniqueSlugs.length} />

      {sessions.length === 0 ? (
        <EmptyState />
      ) : (
        <SessionsList sessions={sessions} metaBySlug={metaBySlug} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function PageHeader({
  sessions,
  agentCount,
}: {
  sessions: ChatSessionSummary[];
  agentCount: number;
}) {
  const lastActivity = sessions[0]?.lastActivityAt;

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
        {sessions.length === 0
          ? 'No conversations yet'
          : `${sessions.length} ${sessions.length === 1 ? 'conversation' : 'conversations'}`}
      </h1>

      {sessions.length > 0 && (
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
  metaBySlug,
}: {
  sessions: ChatSessionSummary[];
  metaBySlug: Map<string, AgentMetadata | null>;
}) {
  // Bucket sessions by date band, preserving newest-first order within each.
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
                <SessionCard key={s.sessionId} session={s} meta={metaBySlug.get(s.agentSlug) ?? null} />
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
