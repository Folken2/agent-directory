import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isAnalyticsOpsEmail } from '@/lib/analytics/ops-access';

export const dynamic = 'force-dynamic';

export const metadata = {
  robots: { index: false, follow: false },
};

/**
 * Access check outside the loading boundary: anyone not on the ops list gets
 * a real 404 before anything (title included) is streamed.
 */
export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!isAnalyticsOpsEmail(session?.user?.email)) notFound();
  return <>{children}</>;
}
