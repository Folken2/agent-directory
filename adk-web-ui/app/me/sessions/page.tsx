import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { listUserSessions } from '@/lib/db-me';
import { formatAgentDisplayName } from '@/lib/agent-utils';
import { MessageSquare, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Your sessions',
  robots: { index: false, follow: false },
};

function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function truncate(s: string | null, max = 140): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max).trimEnd() + '…' : s;
}

export default async function MySessionsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/me/sessions');
  }

  if (!process.env.DATABASE_URL) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-semibold">Your sessions</h1>
        <p className="mt-3 text-muted-foreground">
          Database isn&apos;t configured, so we can&apos;t show your past chats.
        </p>
      </div>
    );
  }

  const sessions = await listUserSessions(session.user.id);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Your sessions</h1>
        <p className="text-sm text-muted-foreground">
          Conversations you&apos;ve had with agents on this account. Click any session to read the transcript.
        </p>
      </header>

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-border/50 p-8 text-center">
          <MessageSquare className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm text-foreground">No sessions yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Start a chat with any agent and it&apos;ll show up here.
          </p>
          <Link
            href="/agents"
            className="inline-block mt-4 px-3 py-1.5 text-xs rounded-md bg-foreground text-background hover:opacity-90"
          >
            Browse agents
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border/50 border border-border/50 rounded-lg overflow-hidden">
          {sessions.map((s) => (
            <li key={s.sessionId}>
              <Link
                href={`/me/sessions/${encodeURIComponent(s.sessionId)}`}
                className="block px-4 py-3.5 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="text-xs font-medium text-foreground">
                    {formatAgentDisplayName(s.agentSlug)}
                  </span>
                  <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {relativeDate(s.lastActivityAt)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {s.messageCount} {s.messageCount === 1 ? 'message' : 'messages'}
                  </span>
                </div>
                <p className="text-[13px] text-foreground/85 leading-snug">
                  {truncate(s.firstMessage) || (
                    <span className="text-muted-foreground italic">(no text content)</span>
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
