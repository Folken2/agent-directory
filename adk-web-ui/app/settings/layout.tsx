export const dynamic = 'force-dynamic';

export const metadata = {
  robots: { index: false, follow: false },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-2xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">{children}</div>;
}
