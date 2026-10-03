import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { requireSettingsUser } from '@/lib/settings-auth';

export const metadata = {
  title: 'Connections',
  robots: { index: false, follow: false },
};

const planned = [
  {
    name: 'Gmail',
    description: 'Let agents read or draft with your Gmail when you opt in.',
  },
  {
    name: 'Other MCPs',
    description: 'Connect additional Model Context Protocol apps for richer tool use.',
  },
] as const;

export default async function SettingsConnectionsPage() {
  await requireSettingsUser('/settings/connections');

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-headline-small text-md-on-surface">Connections</h1>
        <p className="text-sm text-md-on-surface-variant">
          Link external apps so signed-in agents can use your accounts — when this ships.
        </p>
      </header>

      <Card variant="filled" className="space-y-2 p-6">
        <p className="text-sm font-medium text-md-on-surface">Coming soon</p>
        <p className="text-sm text-md-on-surface-variant">
          Connect flows are not available yet. Nothing below can be enabled today.
        </p>
      </Card>

      <Card variant="outlined" className="overflow-hidden">
        <ul className="divide-y divide-md-outline-variant">
          {planned.map((item) => (
            <li key={item.name} className="flex items-start justify-between gap-4 px-4 py-3.5">
              <div>
                <p className="text-sm font-medium text-md-on-surface">{item.name}</p>
                <p className="mt-0.5 text-xs text-md-on-surface-variant">{item.description}</p>
              </div>
              <Chip variant="category" className="shrink-0">Not available</Chip>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
