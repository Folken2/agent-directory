import { requireSettingsUser } from '@/lib/settings-auth';

export const metadata = {
  title: 'API keys',
  robots: { index: false, follow: false },
};

export default async function SettingsKeysPage() {
  await requireSettingsUser('/settings/keys');

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">API keys</h1>
        <p className="text-sm text-muted-foreground">
          Bring your own keys (BYOK) so agents can use your provider quotas instead of the shared
          directory defaults.
        </p>
      </header>

      <div className="rounded-lg border border-dashed border-border/60 p-6 space-y-2">
        <p className="text-sm font-medium text-foreground">Coming soon</p>
        <p className="text-sm text-muted-foreground">
          Key entry and secure storage are not available yet. You can keep using free open-source
          agents from the directory without configuring keys here.
        </p>
      </div>
    </div>
  );
}
