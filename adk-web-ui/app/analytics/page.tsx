import AnalyticsPreview from '@/components/analytics/AnalyticsPreview';

export const metadata = {
  title: 'Analytics | ADK Agent Directory',
  description: 'Directory visit analytics by country and crawler.',
};

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-md-surface pt-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <header className="mb-12 text-center">
          <h1 className="text-display-small text-md-on-surface mb-3">Analytics</h1>
          <p className="text-body-large text-md-on-surface-variant max-w-xl mx-auto">
            Where the directory is being read — people and crawlers.
          </p>
        </header>
        <AnalyticsPreview />
      </div>
    </div>
  );
}
