import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { requireSettingsUser } from '@/lib/settings-auth';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import SignOutButton from '@/components/auth/SignOutButton';
import { cn } from '@/lib/utils';
import { panelClass } from '@/components/ui/card';
import { Page, PageHeader } from '@/components/layout/Page';

export const metadata = {
  title: 'Settings | ADK Agent Directory',
  robots: { index: false, follow: false },
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3">
      <span className="text-body-large text-md-on-surface">{label}</span>
      {children}
    </div>
  );
}

export default async function SettingsPage() {
  const session = await requireSettingsUser('/settings');
  const name = session.user?.name?.trim() || null;
  const email = session.user?.email?.trim() || null;

  return (
    <Page>
      <PageHeader title="Settings" description="Your account and how the site looks." />

      <div className={cn(panelClass, 'max-w-3xl divide-y divide-md-outline/60 overflow-hidden dark:divide-md-outline-variant')}>
        <Row label="Account">
          <span className="min-w-0 text-right">
            {name ? <span className="block text-body-medium text-md-on-surface">{name}</span> : null}
            <span className="block truncate text-body-medium text-md-on-surface-variant">
              {email ?? 'Signed in with Google'}
            </span>
          </span>
        </Row>
        <Row label="Theme">
          <ThemeToggle showLabels />
        </Row>
        <Link
          href="/me/sessions"
          className="flex min-h-16 items-center justify-between gap-6 px-5 py-3 transition-colors hover:bg-md-on-surface/4 focus-visible:bg-md-on-surface/8 focus-visible:outline-none"
        >
          <span>
            <span className="block text-body-large text-md-on-surface">Chat history</span>
            <span className="block text-body-medium text-md-on-surface-variant">Conversations saved to this account</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-md-on-surface-variant" aria-hidden />
        </Link>
      </div>

      <div className="mt-6">
        <SignOutButton />
      </div>
    </Page>
  );
}
