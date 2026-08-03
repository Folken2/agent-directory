import Link from 'next/link';
import { auth } from '@/lib/auth';
import { isAnalyticsOpsEmail } from '@/lib/analytics/ops-access';

/** Quiet link to ops analytics — only for allowlisted session emails. */
export default async function AnalyticsOpsLink() {
  const session = await auth();
  if (!isAnalyticsOpsEmail(session?.user?.email)) return null;

  return (
    <p className="mt-6 text-center">
      <Link
        href="/analytics/ops"
        className="text-label-small text-md-on-surface-variant/50 hover:text-md-on-surface-variant transition-colors"
      >
        Ops
      </Link>
    </p>
  );
}
