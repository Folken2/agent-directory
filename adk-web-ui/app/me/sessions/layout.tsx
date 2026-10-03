import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Sign-in check outside the loading boundary, so the redirect is a real 307. */
export default async function ChatHistoryLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin?callbackUrl=/me/sessions');
  return <>{children}</>;
}
