import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { isAnalyticsOpsEmail } from '@/lib/analytics/ops-access';
import AnalyticsOpsClient from '@/components/analytics/AnalyticsOpsClient';

export const metadata = {
  title: 'Analytics Ops | ADK Agent Directory',
  robots: { index: false, follow: false },
};

export default async function AnalyticsOpsPage() {
  const session = await auth();
  if (!isAnalyticsOpsEmail(session?.user?.email)) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-md-surface pt-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <header className="mb-10">
          <p className="text-label-small uppercase tracking-widest text-md-on-surface-variant/60 mb-2">
            Ops
          </p>
          <h1 className="text-display-small text-md-on-surface mb-3 tracking-tight">
            Analytics
          </h1>
          <p className="text-body-large text-md-on-surface-variant max-w-xl">
            Denser directory metrics — not linked publicly.
          </p>
          <p className="mt-4">
            <Link
              href="/analytics"
              className="text-label-medium text-md-primary hover:underline"
            >
              ← Public analytics
            </Link>
          </p>
        </header>
        <AnalyticsOpsClient />
      </div>
    </div>
  );
}
