'use client';

import { Clock, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { panelClass } from '@/components/ui/card';

interface RateLimitBannerProps {
  count: number;
  limit: number;
  userType: 'authenticated' | 'anonymous';
  onDismiss?: () => void;
}

// Default of RATE_LIMIT_USER_DAILY (lib/limits/limiter.ts).
const SIGNED_IN_DAILY_LIMIT = 20;

export default function RateLimitBanner({ limit, userType, onDismiss }: RateLimitBannerProps) {
  const isAnonymous = userType === 'anonymous';
  const pathname = usePathname() ?? '/chat';
  const query = useSearchParams()?.toString();
  // Come back to this same chat after signing in.
  const signInHref = `/auth/signin?callbackUrl=${encodeURIComponent(query ? `${pathname}?${query}` : pathname)}`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        className="mx-4 mb-4"
      >
        <div role="status" className={cn(panelClass, 'flex items-start gap-3 p-4 shadow-sm')}>
          <Clock className="mt-0.5 size-5 shrink-0 text-md-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-title-small text-md-on-surface">You&apos;ve reached today&apos;s limit</p>
            <p className="mt-1 text-body-medium text-md-on-surface-variant">
              {isAnonymous
                ? `You've used all ${limit} free messages for today. Sign in for ${SIGNED_IN_DAILY_LIMIT} a day, and your chats are saved.`
                : `You've used all ${limit} messages for today. The limit resets at midnight UTC.`}
            </p>
            {isAnonymous ? (
              <Link href={signInHref} className={cn(buttonVariants({ variant: 'filled', size: 'sm' }), 'mt-3')}>
                Sign in
              </Link>
            ) : null}
          </div>
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="shrink-0 rounded-full p-1.5 text-md-on-surface-variant transition-colors hover:bg-md-on-surface/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
