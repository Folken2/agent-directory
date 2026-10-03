'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, LogIn, LogOut } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { ThemeMenu, ThemeToggle } from '@/components/theme/ThemeToggle';
import UserProfile from '@/components/auth/UserProfile';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import SignOutButton from '@/components/auth/SignOutButton';

const destinations = [
  { name: 'Build', href: '/' },
  { name: 'Examples', href: '/examples' },
  { name: 'About', href: '/about' },
];

export function isActiveRoute(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
}

function NavLink({ href, className, ...props }: React.ComponentProps<typeof Link>) {
  const pathname = usePathname() ?? '/';
  const active = isActiveRoute(pathname, String(href));
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex items-center rounded-full px-4 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary',
        active
          ? 'bg-md-on-surface/8 text-md-on-surface'
          : 'text-md-on-surface-variant hover:bg-md-on-surface/8 hover:text-md-on-surface',
        className ?? 'h-9'
      )}
      {...props}
    />
  );
}

function Avatar({ name, image }: { name?: string | null; image?: string | null }) {
  if (image) {
    return <Image src={image} alt="" width={32} height={32} className="h-8 w-8 rounded-full" />;
  }
  return (
    <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-md-primary-container text-sm font-medium text-md-on-primary-container">
      {(name || 'U').charAt(0).toUpperCase()}
    </span>
  );
}

export default function Navigation() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated' && !!session?.user;

  if (pathname?.startsWith('/chat')) return null;

  // Return to the current page after signing in.
  const signInHref =
    pathname && pathname !== '/' && !pathname.startsWith('/auth')
      ? `/auth/signin?callbackUrl=${encodeURIComponent(pathname)}`
      : '/auth/signin';

  const accountLinks = isAuthenticated
    ? [
        { name: 'Chat history', href: '/me/sessions' },
        { name: 'Settings', href: '/settings' },
      ]
    : [];

  return (
    <header className="sticky top-0 z-50 bg-md-surface-container-low/85 backdrop-blur supports-[backdrop-filter]:bg-md-surface-container-low/70">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
      >
        <Link href="/" aria-label="Agent Directory home" className="-ml-1 flex items-center gap-2.5 rounded-full p-1 pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary">
          <Image src="/adk-logo.png" alt="" width={28} height={28} className="h-7 w-7" priority />
          <span className="text-[17px] font-medium tracking-tight text-md-on-surface">
            Agent Directory
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {destinations.map((d) => (
            <NavLink key={d.href} href={d.href}>{d.name}</NavLink>
          ))}
          <ThemeMenu className="ml-2" />
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="text" size="icon" className="ml-1" aria-label="Account">
                  <Avatar name={session?.user?.name} image={session?.user?.image} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>
                  <span className="block text-sm font-medium text-md-on-surface">{session?.user?.name || 'User'}</span>
                  {session?.user?.email && (
                    <span className="block text-xs font-normal text-md-on-surface-variant">{session.user.email}</span>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {accountLinks.map((d) => (
                  <DropdownMenuItem key={d.href} asChild>
                    <Link href={d.href}>{d.name}</Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => { void signOut({ callbackUrl: '/' }); }}>
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : pathname?.startsWith('/auth') ? null : (
            <Link href={signInHref} className={cn(buttonVariants({ variant: 'filled', size: 'sm' }), 'ml-1 h-9 px-4')}>
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
                  <NavLink href={d.href} className="h-12">{d.name}</NavLink>
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
                    <Link href={signInHref} className={cn(buttonVariants({ variant: 'filled' }), 'w-full')}>
                      <LogIn /> Sign in
                    </Link>
                  </SheetClose>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
