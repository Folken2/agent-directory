import { requireSettingsUser } from '@/lib/settings-auth';

export const dynamic = 'force-dynamic';

export const metadata = {
  robots: { index: false, follow: false },
};

/**
 * The sign-in check runs here, outside the loading boundary, so a signed-out
 * visitor gets a real redirect instead of a streamed page that redirects late.
 */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireSettingsUser('/settings');
  return <>{children}</>;
}
