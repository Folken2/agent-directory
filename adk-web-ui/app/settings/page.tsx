import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { requireSettingsUser } from '@/lib/settings-auth';

export const metadata = {
  title: 'Settings',
  robots: { index: false, follow: false },
};

const linkClass = 'block px-4 py-3.5 transition-colors hover:bg-md-on-surface/8';

export default async function SettingsOverviewPage() {
  const session = await requireSettingsUser('/settings');
  const name = session.user?.name?.trim() || null;
  const email = session.user?.email?.trim() || null;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-headline-small text-md-on-surface">Settings</h1>
        <p className="text-sm text-md-on-surface-variant">
          Account preferences for Agent Directory. Some unlocks are listed here before they ship.
        </p>
      </header>

      <Card variant="outlined" className="space-y-1 p-4">
        <h2 className="text-sm font-medium text-md-on-surface">Account</h2>
        {name ? <p className="text-sm text-md-on-surface">{name}</p> : null}
        {email ? (
          <p className="text-sm text-md-on-surface-variant">{email}</p>
        ) : (
          <p className="text-sm text-md-on-surface-variant">Signed in with Google</p>
        )}
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-md-on-surface">Coming later</h2>
        <p className="text-sm text-md-on-surface-variant">
          Signed-in accounts will be able to bring your own API keys and connect Gmail or other MCPs
          for richer agent runs. Those controls are not available yet — the pages below are honest
          placeholders.
        </p>
        <Card variant="outlined" className="overflow-hidden">
          <ul className="divide-y divide-md-outline-variant">
            <li>
              <Link href="/settings/keys" className={linkClass}>
                <p className="text-sm font-medium text-md-on-surface">API keys (BYOK)</p>
                <p className="mt-0.5 text-xs text-md-on-surface-variant">Not available yet</p>
              </Link>
            </li>
            <li>
              <Link href="/settings/connections" className={linkClass}>
                <p className="text-sm font-medium text-md-on-surface">Connections</p>
                <p className="mt-0.5 text-xs text-md-on-surface-variant">Gmail and MCPs — not available yet</p>
              </Link>
            </li>
            <li>
              <Link href="/me/sessions" className={linkClass}>
                <p className="text-sm font-medium text-md-on-surface">Your sessions</p>
                <p className="mt-0.5 text-xs text-md-on-surface-variant">Saved chat history on this account</p>
              </Link>
            </li>
          </ul>
        </Card>
      </section>
    </div>
  );
}
