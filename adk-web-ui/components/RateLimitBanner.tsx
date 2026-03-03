'use client';

import { AlertCircle, X, LogIn } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface RateLimitBannerProps {
  count: number;
  limit: number;
  userType: 'authenticated' | 'anonymous';
  onDismiss?: () => void;
}

export default function RateLimitBanner({ count, limit, userType, onDismiss }: RateLimitBannerProps) {
  const isAnonymous = userType === 'anonymous';
  const authenticatedLimit = 20; // Should match RATE_LIMITS.authenticated

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="mx-4 mb-4"
      >
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                Daily Limit Reached
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                {isAnonymous ? (
                  <>
                    You've used all <strong>{limit} free interactions</strong> for today. 
                    Sign in to get <strong>{authenticatedLimit} interactions per day</strong> and unlock extended limits.
                  </>
                ) : (
                  <>
                    You've reached your daily limit of <strong>{limit} interactions</strong>. 
                    Please try again tomorrow.
                  </>
                )}
              </p>
              {isAnonymous && (
                <Link
                  href="/auth/signin"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 rounded-lg transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In for Extended Limits
                </Link>
              )}
            </div>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="flex-shrink-0 p-1 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-lg transition-colors"
                aria-label="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

