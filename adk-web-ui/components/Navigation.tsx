'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, LogIn, LogOut } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
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
          ? 'bg-md-primary-container text-md-on-primary-container'
          : 'text-md-on-surface-variant hover:bg-md-on-surface/8 hover:text-md-on-surface',
        className ?? 'h-10'
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

  const accountLinks = isAuthenticated
    ? [
        { name: 'Sessions', href: '/me/sessions' },
        { name: 'Settings', href: '/settings' },
      ]
    : [];

  return (
    <div className="sticky top-0 z-50 bg-md-surface-container-low/80 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-md-surface-container-low/70">
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 max-w-7xl items-center justify-between rounded-full bg-md-surface-container px-2 pl-4"
      >
        <Link href="/" aria-label="Agent Directory home" className="flex items-center gap-2 rounded-full pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary">
          <Image src="/logo.svg" alt="" width={28} height={28} className="h-7 w-7" priority unoptimized />
          <span className="hidden text-base font-medium text-md-on-surface sm:inline">
            Agent <span className="text-md-primary">Directory</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {destinations.map((d) => (
            <NavLink key={d.href} href={d.href}>{d.name}</NavLink>
          ))}
          <ThemeToggle className="ml-2" />
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="text" size="icon" className="ml-2" aria-label="Account">
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
