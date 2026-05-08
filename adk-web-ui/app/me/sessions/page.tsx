import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { listSessionsForUser } from '@/lib/sessions';
import { loadAgentMetadata, type AgentMetadata } from '@/lib/agent-metadata';
import SessionsBrowser from '@/components/sessions/SessionsBrowser';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Your sessions',
  robots: { index: false, follow: false },
};

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

  // Load metadata for every unique agent slug present in the user's
  // session history. Reads from disk synchronously per slug (a handful at
  // most), then hands the result down as a plain object so it crosses the
  // server→client boundary cleanly.
  const uniqueSlugs = Array.from(new Set(sessions.map((s) => s.agentSlug)));
  const agentMetadata: Record<string, AgentMetadata | null> = {};
  for (const slug of uniqueSlugs) {
    agentMetadata[slug] = loadAgentMetadata(slug);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <SessionsBrowser sessions={sessions} agentMetadata={agentMetadata} />
    </div>
  );
}
