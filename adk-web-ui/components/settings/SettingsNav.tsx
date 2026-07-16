'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const sections = [
  { name: 'Overview', href: '/settings' },
  { name: 'API keys', href: '/settings/keys' },
  { name: 'Connections', href: '/settings/connections' },
] as const;

export default function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings sections" className="flex flex-wrap gap-1 border-b border-border/50 pb-3">
      {sections.map((section) => {
        const active =
          section.href === '/settings'
            ? pathname === '/settings'
            : pathname?.startsWith(section.href);

        return (
          <Link
            key={section.href}
            href={section.href}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              active
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            {section.name}
          </Link>
        );
      })}
    </nav>
  );
}
