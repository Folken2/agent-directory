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
    <nav aria-label="Settings sections" className="flex flex-wrap gap-1 border-b border-md-outline-variant pb-3">
      {sections.map((section) => {
        const active =
          section.href === '/settings'
            ? pathname === '/settings'
            : pathname?.startsWith(section.href);

        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary',
              active
                ? 'bg-md-primary-container text-md-on-primary-container'
                : 'text-md-on-surface-variant hover:bg-md-on-surface/8 hover:text-md-on-surface'
            )}
          >
            {section.name}
          </Link>
        );
      })}
    </nav>
  );
}
