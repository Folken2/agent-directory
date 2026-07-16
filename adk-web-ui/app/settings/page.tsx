import Link from 'next/link';
import { requireSettingsUser } from '@/lib/settings-auth';

export const metadata = {
  title: 'Settings',
  robots: { index: false, follow: false },
};

export default async function SettingsOverviewPage() {
  const session = await requireSettingsUser('/settings');
  const name = session.user?.name?.trim() || null;
  const email = session.user?.email?.trim() || null;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Account preferences for Agent Directory. Some unlocks are listed here before they ship.
        </p>
      </header>

      <section className="rounded-lg border border-border/50 p-4 space-y-1">
        <h2 className="text-sm font-medium text-foreground">Account</h2>
        {name ? <p className="text-sm text-foreground">{name}</p> : null}
        {email ? (
          <p className="text-sm text-muted-foreground">{email}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Signed in with Google</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Coming later</h2>
        <p className="text-sm text-muted-foreground">
          Signed-in accounts will be able to bring your own API keys and connect Gmail or other MCPs
          for richer agent runs. Those controls are not available yet — the pages below are honest
          placeholders.
        </p>
        <ul className="divide-y divide-border/50 border border-border/50 rounded-lg overflow-hidden">
          <li>
            <Link
              href="/settings/keys"
              className="block px-4 py-3.5 hover:bg-muted/40 transition-colors"
            >
              <p className="text-sm font-medium text-foreground">API keys (BYOK)</p>
              <p className="text-xs text-muted-foreground mt-0.5">Not available yet</p>
            </Link>
          </li>
          <li>
            <Link
              href="/settings/connections"
              className="block px-4 py-3.5 hover:bg-muted/40 transition-colors"
            >
              <p className="text-sm font-medium text-foreground">Connections</p>
              <p className="text-xs text-muted-foreground mt-0.5">Gmail and MCPs — not available yet</p>
            </Link>
          </li>
          <li>
            <Link
              href="/me/sessions"
              className="block px-4 py-3.5 hover:bg-muted/40 transition-colors"
            >
              <p className="text-sm font-medium text-foreground">Your sessions</p>
              <p className="text-xs text-muted-foreground mt-0.5">Saved chat history on this account</p>
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
