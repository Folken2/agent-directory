'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import UserProfile from '@/components/auth/UserProfile';
import SignOutButton from '@/components/auth/SignOutButton';

const navigation = [
  { name: 'Agents', href: '/' },
  { name: 'About', href: '/about' },
];

export default function Navigation() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const isAuthenticated = status === 'authenticated' && !!session?.user;

  // Hide navigation on chat page (must be after all hooks)
  if (pathname?.startsWith('/chat')) {
    return null;
  }

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="bg-md-surface elevation-2 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Image
                src="/adk_logo.png"
                alt="ADK Logo"
                width={32}
                height={32}
                className="w-8 h-8"
                priority
              />
              <h1 className="text-lg font-semibold text-md-on-surface tracking-tight hidden sm:block">
                Agent Directory
              </h1>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'relative px-4 py-2 text-sm font-medium transition-colors rounded-lg',
                  isActive(item.href)
                    ? 'text-md-primary'
                    : 'text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-surface-variant'
                )}
                onClick={() => {
                  if (item.href.startsWith('#')) {
                    // Handle anchor links
                    const element = document.querySelector(item.href);
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth' });
                    }
                  }
                }}
              >
                {item.name}
                {isActive(item.href) && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-md-primary rounded-full" />
                )}
              </Link>
            ))}

            {/* Auth Section - Desktop */}
            <div className="hidden md:flex items-center gap-3 ml-4 pl-4 border-l border-md-outline">
              {isAuthenticated ? (
                <>
                  <Link
                    href="/me/sessions"
                    className={cn(
                      'px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                      isActive('/me/sessions')
                        ? 'text-md-primary'
                        : 'text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-surface-variant'
                    )}
                  >
                    Sessions
                  </Link>
                  <Link
                    href="/settings"
                    className={cn(
                      'px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                      isActive('/settings')
                        ? 'text-md-primary'
                        : 'text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-surface-variant'
                    )}
                  >
                    Settings
                  </Link>
                  <UserProfile />
                  <SignOutButton />
                </>
              ) : (
                <Link
                  href="/auth/signin"
                  className="px-4 py-2 text-sm font-medium text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-surface-variant rounded-lg transition-colors"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-surface-variant transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'block px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-md-primary-container text-md-on-primary-container'
                    : 'text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-surface-variant'
                )}
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (item.href.startsWith('#')) {
                    setTimeout(() => {
                      const element = document.querySelector(item.href);
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth' });
                      }
                    }, 100);
                  }
                }}
              >
                {item.name}
              </Link>
            ))}

            {/* Auth Section - Mobile */}
            <div className="pt-2 border-t border-md-outline mt-2">
              {isAuthenticated ? (
                <div className="px-4 py-3 space-y-2">
                  <UserProfile />
                  <Link
                    href="/me/sessions"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-2 text-sm font-medium text-md-on-surface-variant hover:text-md-on-surface"
                  >
                    Your sessions
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-2 text-sm font-medium text-md-on-surface-variant hover:text-md-on-surface"
                  >
                    Settings
                  </Link>
                  <SignOutButton />
                </div>
              ) : (
                <Link
                  href="/auth/signin"
                  className="block px-4 py-3 rounded-lg text-sm font-medium text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-surface-variant transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

