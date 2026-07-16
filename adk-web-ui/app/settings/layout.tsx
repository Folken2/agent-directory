import SettingsNav from '@/components/settings/SettingsNav';

export const dynamic = 'force-dynamic';

export const metadata = {
  robots: { index: false, follow: false },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <SettingsNav />
      {children}
    </div>
  );
}
