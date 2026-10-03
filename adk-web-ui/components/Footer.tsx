'use client';

import Link from 'next/link';
import { NOT_AFFILIATED_NOTICE } from '@/lib/site';
import DirectoryPulse from '@/components/analytics/DirectoryPulse';

/** Only render an external link when its URL is configured and valid. */
function configuredUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

const linkClass =
  'rounded-sm transition-colors hover:text-md-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary';

export default function Footer() {
  const external = [
    { label: 'GitHub', href: configuredUrl(process.env.NEXT_PUBLIC_GITHUB_URL) },
    { label: 'LinkedIn', href: configuredUrl(process.env.NEXT_PUBLIC_LINKEDIN_URL) },
    { label: 'Website', href: configuredUrl(process.env.NEXT_PUBLIC_PERSONAL_URL) },
  ].filter((l): l is { label: string; href: string } => l.href !== null);

  return (
    <footer className="border-t border-md-outline/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 sm:px-6 lg:px-8">
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-md-on-surface-variant">
          <Link href="/about" className={linkClass}>About</Link>
          <Link href="/privacy" className={linkClass}>Privacy</Link>
          {external.map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className={linkClass}>
              {l.label}
            </a>
          ))}
          <DirectoryPulse className={linkClass} />
        </nav>
        <p className="text-xs leading-relaxed text-md-on-surface-variant">
          © {new Date().getFullYear()} Agent Directory. {NOT_AFFILIATED_NOTICE}
        </p>
      </div>
    </footer>
  );
}
