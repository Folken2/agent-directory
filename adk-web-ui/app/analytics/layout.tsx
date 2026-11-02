import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isAnalyticsOpsEmail } from '@/lib/analytics/ops-access';

export const dynamic = 'force-dynamic';

export const metadata = {
  robots: { index: false, follow: false },
};

/**
 * Every analytics page is private. The check runs outside the loading
 * boundaries, so anyone not on the ops list gets a real 404 before anything
 * is streamed.
 */
export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!isAnalyticsOpsEmail(session?.user?.email)) notFound();
  return <>{children}</>;
}
