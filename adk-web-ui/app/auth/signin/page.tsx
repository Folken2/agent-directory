import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { History, MessagesSquare, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { safeCallbackPath, signInErrorMessage } from '@/lib/auth/callback-url';
import { limitsFromEnv } from '@/lib/limits/limiter';
import { panelClass } from '@/components/ui/card';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';

export const metadata: Metadata = {
  title: 'Sign in | ADK Agent Directory',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function Benefit({ icon: Icon, title, children }: { icon: typeof History; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-md-primary-container text-md-on-primary-container">
        <Icon className="size-5" aria-hidden />
      </span>
      <span>
        <span className="block text-title-small text-md-on-surface">{title}</span>
        <span className="mt-0.5 block text-body-medium text-md-on-surface-variant">{children}</span>
      </span>
    </li>
  );
}

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const callbackUrl = safeCallbackPath(params.callbackUrl);
  const error = signInErrorMessage(params.error);
  const limits = limitsFromEnv();
  // Account pages would bounce straight back here, so offer the examples instead.
  const canContinue = callbackUrl !== '/' && !/^\/(settings|me)(\/|\?|$)/.test(callbackUrl);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-12rem)] w-full max-w-5xl items-center px-4 py-12 sm:px-6">
      <div className={cn(panelClass, 'grid w-full overflow-hidden md:grid-cols-[1.1fr_1fr]')}>
        <div className="p-8 sm:p-12">
          <Image src="/adk-logo.png" alt="" width={40} height={40} className="size-10" />
          <h1 className="mt-8 text-display-small tracking-tight text-md-on-surface">Sign in</h1>
          <p className="mt-3 text-body-large text-md-on-surface-variant">to continue to Agent Directory</p>

          <ul className="mt-10 space-y-6">
            <Benefit icon={History} title="Keep your conversations">
              Chats are saved to your account, so you can pick up a design where you left off, on any device.
            </Benefit>
            <Benefit icon={MessagesSquare} title="More messages each day">
              {limits.user} messages a day instead of {limits.anon} without an account.
            </Benefit>
            <Benefit icon={ShieldCheck} title="Only what sign-in needs">
              Your Google name, email and picture. No access to your mail, files or contacts.
            </Benefit>
          </ul>
        </div>

        <div className="flex flex-col justify-center border-t border-md-outline/60 bg-md-surface-container-low p-8 sm:p-12 md:border-l md:border-t-0 dark:border-md-outline-variant dark:bg-md-surface">
          {error ? (
            <p role="alert" className="mb-6 rounded-[var(--md-shape-md)] bg-md-error-container px-4 py-3 text-body-medium text-md-on-error-container">
              {error}
            </p>
          ) : null}
          <GoogleSignInButton callbackUrl={callbackUrl} />
          <p className="mt-6 text-body-small text-md-on-surface-variant">
            See how we handle your data in the{' '}
            <Link href="/privacy" className="text-md-primary underline-offset-4 hover:underline">
              privacy notice
            </Link>
            .
          </p>
          <div className="mt-10 border-t border-md-outline/60 pt-6 dark:border-md-outline-variant">
            <p className="text-body-medium text-md-on-surface-variant">Signing in is optional.</p>
            <Link
              href={canContinue ? callbackUrl : '/examples'}
              className="mt-1 inline-flex text-label-large text-md-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary rounded-sm"
            >
              {canContinue ? 'Continue without signing in' : 'Try the examples without an account'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
