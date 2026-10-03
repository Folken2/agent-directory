import { Card } from '@/components/ui/card';
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
        <h1 className="text-headline-small text-md-on-surface">API keys</h1>
        <p className="text-sm text-md-on-surface-variant">
          Bring your own keys (BYOK) so agents can use your provider quotas instead of the shared
          directory defaults.
        </p>
      </header>

      <Card variant="filled" className="space-y-2 p-6">
        <p className="text-sm font-medium text-md-on-surface">Coming soon</p>
        <p className="text-sm text-md-on-surface-variant">
          Key entry and secure storage are not available yet. You can keep using free open-source
          agents from the directory without configuring keys here.
        </p>
      </Card>
    </div>
  );
}
