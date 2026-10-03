import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { listSessionsForUser, type ChatSessionSummary } from '@/lib/sessions';
import { loadAgentMetadata, type AgentMetadata } from '@/lib/agent-metadata';
import { formatAgentDisplayName } from '@/lib/agent-utils';
import { buttonVariants } from '@/components/ui/button';
import AgentLogo from '@/components/agent/AgentLogo';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Chat history | ADK Agent Directory',
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
      <div className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <h1 className="text-headline-large tracking-tight text-md-on-surface">Chat history</h1>
        <p className="mt-3 text-body-large text-md-on-surface-variant">
          Chat history isn&apos;t available right now.
        </p>
      </div>
    );
  }

  const sessions = await listSessionsForUser(session.user.id);

  // Load agent metadata once per unique slug so rows can show names and
  // logos. listSessionsForUser already returns sessions newest-first.
  const uniqueSlugs = Array.from(new Set(sessions.map((s) => s.agentSlug)));
  const metaBySlug = new Map<string, AgentMetadata | null>();
  for (const slug of uniqueSlugs) {
    metaBySlug.set(slug, loadAgentMetadata(slug));
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
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
      <h1 className="text-headline-large tracking-tight text-md-on-surface">Chat history</h1>
      {sessions.length > 0 ? (
        <p className="mt-2 text-body-large text-md-on-surface-variant">
          {sessions.length} {sessions.length === 1 ? 'conversation' : 'conversations'} with {agentCount}{' '}
          {agentCount === 1 ? 'agent' : 'agents'}
          {lastActivity ? ` · last active ${relativeTime(lastActivity)}` : null}
        </p>
      ) : null}
    </header>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[var(--md-shape-lg)] border border-md-outline/70 bg-md-surface px-6 py-14 text-center">
      <h2 className="text-title-large text-md-on-surface">No conversations yet</h2>
      <p className="mx-auto mt-2 max-w-sm text-body-medium text-md-on-surface-variant">
        Chats you have while signed in show up here, so you can pick up where you left off.
      </p>
      <Link href="/" className={`${buttonVariants({ variant: 'filled' })} mt-6`}>
        Build an agent
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
    <div className="space-y-8">
      {orderedBands.map((band) => {
        const items = bands[band];
        if (items.length === 0) return null;
        return (
          <section key={band} aria-labelledby={`band-${band}`}>
            <h2 id={`band-${band}`} className="mb-2 px-1 text-title-small text-md-on-surface-variant">
              {BAND_LABELS[band]}
            </h2>
            <ul className="divide-y divide-md-outline/60 overflow-hidden rounded-[var(--md-shape-lg)] border border-md-outline/70 bg-md-surface">
              {items.map((s) => (
                <li key={s.sessionId}>
                  <SessionRow session={s} meta={metaBySlug.get(s.agentSlug) ?? null} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function SessionRow({
  session,
  meta,
}: {
  session: ChatSessionSummary;
  meta: AgentMetadata | null;
}) {
  const displayName = meta?.displayName || formatAgentDisplayName(session.agentSlug);
  const preview = truncate(session.firstMessage);

  return (
    <Link
      href={`/chat?agent=${encodeURIComponent(session.agentSlug)}&session=${encodeURIComponent(session.sessionId)}`}
      className="flex gap-4 px-5 py-4 transition-colors hover:bg-md-on-surface/4 focus-visible:bg-md-on-surface/8 focus-visible:outline-none"
    >
      <AgentLogo src={meta?.logo} name={displayName} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-title-small text-md-on-surface">{displayName}</span>
          <span className="shrink-0 text-label-medium tabular-nums text-md-on-surface-variant">
            {relativeTime(session.lastActivityAt)}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-body-medium text-md-on-surface-variant">
          {preview || 'No text'}
        </p>
        <p className="mt-1 text-label-medium text-md-on-surface-variant">
          {session.messageCount} {session.messageCount === 1 ? 'message' : 'messages'}
        </p>
      </div>
    </Link>
  );
}
