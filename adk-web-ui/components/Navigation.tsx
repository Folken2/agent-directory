'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, LogIn, History, Settings } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import UserProfile from '@/components/auth/UserProfile';
import SignOutButton from '@/components/auth/SignOutButton';

const destinations = [
  { name: 'Agents', href: '/' },
  { name: 'About', href: '/about' },
];

function useIsActive() {
  const pathname = usePathname() ?? '/';
  return (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
}

function NavLink({ href, children, onNavigate }: { href: string; children: React.ReactNode; onNavigate?: () => void }) {
  const isActive = useIsActive();
  const active = isActive(href);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary',
        active
          ? 'bg-md-primary-container text-md-on-primary-container'
          : 'text-md-on-surface-variant hover:bg-md-on-surface/8 hover:text-md-on-surface'
      )}
    >
      {children}
    </Link>
  );
}

export default function Navigation() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated' && !!session?.user;

  if (pathname?.startsWith('/chat')) return null;

  const accountLinks = isAuthenticated
    ? [
        { name: 'Sessions', href: '/me/sessions', Icon: History },
        { name: 'Settings', href: '/settings', Icon: Settings },
      ]
    : [];

  return (
    <div className="sticky top-0 z-50 bg-md-surface-container-low/80 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-md-surface-container-low/70">
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 max-w-7xl items-center justify-between rounded-full bg-md-surface-container px-2 pl-4"
      >
        <Link href="/" className="flex items-center gap-2 rounded-full pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary">
          <Image src="/adk_logo.png" alt="" width={28} height={28} className="h-7 w-7" priority />
          <span className="hidden text-base font-medium text-md-on-surface sm:inline">
            Agent <span className="text-md-primary">Directory</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {destinations.map((d) => (
            <NavLink key={d.href} href={d.href}>{d.name}</NavLink>
          ))}
          {accountLinks.map((d) => (
            <NavLink key={d.href} href={d.href}>{d.name}</NavLink>
          ))}
          <ThemeToggle className="ml-2" />
          {isAuthenticated ? (
            <div className="ml-2 flex items-center gap-2">
              <UserProfile />
              <SignOutButton />
            </div>
          ) : (
            <Link href="/auth/signin" className={cn(buttonVariants({ variant: 'filled', size: 'sm' }), 'ml-2')}>
              Sign in
            </Link>
          )}
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="text" size="icon" className="md:hidden" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" title="Menu">
            <div className="flex flex-col gap-1 px-1">
              {[...destinations, ...accountLinks].map((d) => (
                <SheetClose asChild key={d.href}>
                  <Link
                    href={d.href}
                    aria-current={pathname === d.href ? 'page' : undefined}
                    className="flex h-12 items-center rounded-full px-4 text-sm font-medium text-md-on-surface-variant hover:bg-md-on-surface/8 aria-[current=page]:bg-md-primary-container aria-[current=page]:text-md-on-primary-container"
                  >
                    {d.name}
                  </Link>
                </SheetClose>
              ))}
              <div className="mt-3 border-t border-md-outline-variant px-3 pt-3">
                <ThemeToggle />
              </div>
              <div className="mt-3 px-3">
                {isAuthenticated ? (
                  <div className="flex flex-col gap-3">
                    <UserProfile />
                    <SignOutButton />
                  </div>
                ) : (
                  <SheetClose asChild>
                    <Link href="/auth/signin" className={cn(buttonVariants({ variant: 'filled' }), 'w-full')}>
                      <LogIn /> Sign in
                    </Link>
                  </SheetClose>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}
