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
        <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
        <p className="text-sm text-muted-foreground">
          Link external apps so signed-in agents can use your accounts — when this ships.
        </p>
      </header>

      <div className="rounded-lg border border-dashed border-border/60 p-6 space-y-2">
        <p className="text-sm font-medium text-foreground">Coming soon</p>
        <p className="text-sm text-muted-foreground">
          Connect flows are not available yet. Nothing below can be enabled today.
        </p>
      </div>

      <ul className="divide-y divide-border/50 border border-border/50 rounded-lg overflow-hidden">
        {planned.map((item) => (
          <li key={item.name} className="px-4 py-3.5 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">{item.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground pt-0.5">Not available</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
