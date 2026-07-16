import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

/** Require a signed-in user for private settings pages. */
export async function requireSettingsUser(callbackPath: string) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackPath)}`);
  }
  return session;
}
