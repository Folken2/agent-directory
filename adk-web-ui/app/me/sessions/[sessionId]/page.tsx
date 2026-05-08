import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getUserSessionTranscript } from '@/lib/db-me';
import { formatAgentDisplayName } from '@/lib/agent-utils';
import { ArrowLeft, Bot, User } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Session transcript',
  robots: { index: false, follow: false },
};

function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default async function SessionTranscriptPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId: rawSessionId } = await params;
  const sessionId = decodeURIComponent(rawSessionId);

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/me/sessions/${rawSessionId}`);
  }
  if (!process.env.DATABASE_URL) notFound();

  const transcript = await getUserSessionTranscript(session.user.id, sessionId);
  if (!transcript) notFound();

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <Link
          href="/me/sessions"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All sessions
        </Link>
        <Link
          href={`/chat?agent=${encodeURIComponent(transcript.agentSlug)}`}
          className="text-xs px-3 py-1.5 rounded-md bg-foreground text-background hover:opacity-90"
        >
          Start a new chat with {formatAgentDisplayName(transcript.agentSlug)}
        </Link>
      </header>

      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {formatAgentDisplayName(transcript.agentSlug)}
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          {transcript.turns.length} {transcript.turns.length === 1 ? 'turn' : 'turns'}
          {transcript.turns[0] && ` · started ${fmt(transcript.turns[0].at)}`}
        </p>
      </div>

      <div className="space-y-4">
        {transcript.turns.map((turn, idx) => (
          <div
            key={idx}
            className={
              turn.author === 'user'
                ? 'rounded-lg border border-border/50 bg-muted/30 px-4 py-3'
                : 'rounded-lg border border-border/30 bg-background px-4 py-3'
            }
          >
            <div className="flex items-center gap-1.5 mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground/80">
              {turn.author === 'user' ? (
                <>
                  <User className="w-3 h-3" />
                  You
                </>
              ) : (
                <>
                  <Bot className="w-3 h-3" />
                  {formatAgentDisplayName(transcript.agentSlug)}
                </>
              )}
              <span className="ml-auto normal-case tracking-normal text-muted-foreground/70">
                {fmt(turn.at)}
              </span>
            </div>
            <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90 font-sans">
              {turn.text}
            </pre>
          </div>
        ))}
        {transcript.turns.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            This session has no readable text content.
          </p>
        )}
      </div>
    </div>
  );
}
