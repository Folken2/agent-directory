'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import UserProfile from '@/components/auth/UserProfile';
import SignOutButton from '@/components/auth/SignOutButton';

const navigation = [
  { name: 'Agents', href: '/' },
  { name: 'Trending', href: '/trending' },
  { name: 'Contribute', href: '/contribute' },
  { name: 'About', href: '/about' },
];

const moreMenuItems = [
  { name: 'Learn', href: '/learn', description: 'Tutorials, docs, and resources' },
];

export default function Navigation() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const isAuthenticated = status === 'authenticated' && !!session?.user;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    if (moreMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moreMenuOpen]);

  if (pathname?.startsWith('/chat')) return null;

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };
  const isMoreMenuActive = moreMenuItems.some((item) => isActive(item.href));

  return (
    <nav className="sticky top-0 z-50 bg-background/85 backdrop-blur-md border-b border-md-outline/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Wordmark — Agent Directory in sans, "by folch.ai" in serif italic.
              The whole personal touch concentrates here. */}
          <Link
            href="/"
            className="group flex items-baseline gap-1.5 text-md-on-surface hover:text-md-on-surface transition-colors"
          >
            <span className="text-[15px] font-semibold tracking-tight">Agent Directory</span>
            <span className="font-serif-accent text-[13px] text-md-on-surface-variant group-hover:text-md-tertiary transition-colors">
              by folch.ai
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-0.5">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'px-3 py-1.5 text-[13px] font-medium tracking-tight rounded-full transition-colors',
                  isActive(item.href)
                    ? 'text-md-on-surface bg-md-surface-container'
                    : 'text-md-on-surface-variant hover:text-md-on-surface',
                )}
              >
                {item.name}
              </Link>
            ))}

            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                className={cn(
                  'px-3 py-1.5 text-[13px] font-medium tracking-tight rounded-full transition-colors flex items-center gap-1',
                  isMoreMenuActive
                    ? 'text-md-on-surface bg-md-surface-container'
                    : 'text-md-on-surface-variant hover:text-md-on-surface',
                )}
              >
                More
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', moreMenuOpen && 'rotate-180')} />
              </button>

              {moreMenuOpen && (
                <div className="absolute right-0 mt-2 z-50">
                  <ul className="bg-md-surface rounded-2xl border border-md-outline/60 shadow-elevation-3 overflow-hidden py-1.5 min-w-[220px]">
                    {moreMenuItems.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setMoreMenuOpen(false)}
                          className={cn(
                            'block px-4 py-2.5 text-sm transition-colors',
                            isActive(item.href)
                              ? 'text-md-primary bg-md-primary-container/40'
                              : 'text-md-on-surface hover:bg-md-surface-container-low',
                          )}
                        >
                          <span className="font-medium">{item.name}</span>
                          {item.description && (
                            <span className="block text-[11px] text-md-on-surface-variant mt-0.5">
                              {item.description}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 ml-3 pl-3 border-l border-md-outline/50">
              {isAuthenticated ? (
                <>
                  <UserProfile />
                  <SignOutButton />
                </>
              ) : (
                <Link
                  href="/auth/signin"
                  className="px-3.5 py-1.5 text-[13px] font-medium text-md-on-surface bg-md-surface-container hover:bg-md-surface-container-high rounded-full transition-colors"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-full text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-surface-container transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden pb-4 pt-2 space-y-0.5">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'block px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-md-surface-container text-md-on-surface'
                    : 'text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-surface-container-low',
                )}
              >
                {item.name}
              </Link>
            ))}

            <div className="pt-3 mt-3 border-t border-md-outline/50">
              <div className="px-4 py-1 text-[10px] font-semibold text-md-on-surface-variant uppercase tracking-[0.12em]">
                More
              </div>
              {moreMenuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'block px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-md-surface-container text-md-on-surface'
                      : 'text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-surface-container-low',
                  )}
                >
                  <div>{item.name}</div>
                  <div className="text-xs text-md-on-surface-variant mt-0.5">{item.description}</div>
                </Link>
              ))}
            </div>

            <div className="pt-3 mt-3 border-t border-md-outline/50">
              {isAuthenticated ? (
                <div className="px-4 py-2 space-y-2">
                  <UserProfile />
                  <SignOutButton />
                </div>
              ) : (
                <Link
                  href="/auth/signin"
                  className="block px-4 py-3 rounded-xl text-sm font-medium text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-surface-container-low transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
