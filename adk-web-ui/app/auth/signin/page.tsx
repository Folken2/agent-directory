import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { safeCallbackPath, signInErrorMessage } from '@/lib/auth/callback-url';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';

export const metadata: Metadata = {
  title: 'Sign in | ADK Agent Directory',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const callbackUrl = safeCallbackPath(params.callbackUrl);
  const error = signInErrorMessage(params.error);

  return (
    <div className="flex min-h-[calc(100dvh-14rem)] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm text-center">
        <Image src="/adk-logo.png" alt="" width={40} height={40} className="mx-auto size-10" />
        <h1 className="mt-6 text-headline-small tracking-tight text-md-on-surface">Sign in</h1>
        <p className="mt-2 text-body-large text-md-on-surface-variant">
          Use your Google account to keep your chat history.
        </p>
        {error ? (
          <p role="alert" className="mt-6 rounded-[var(--md-shape-md)] bg-md-error-container px-4 py-3 text-body-medium text-md-on-error-container">
            {error}
          </p>
        ) : null}
        <div className="mt-8">
          <GoogleSignInButton callbackUrl={callbackUrl} />
        </div>
        <p className="mt-6 text-body-small text-md-on-surface-variant">
          Signing in is optional. See how we handle data in the{' '}
          <Link href="/privacy" className="text-md-primary underline-offset-4 hover:underline">
            privacy notice
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
