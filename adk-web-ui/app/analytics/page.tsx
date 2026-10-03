import AnalyticsDashboard from '@/components/analytics/dashboard/AnalyticsDashboard';
import AnalyticsOpsLink from '@/components/analytics/AnalyticsOpsLink';

export const metadata = {
  title: 'Analytics | ADK Agent Directory',
  description: 'Directory traffic: visits, sources, pages, countries and crawlers.',
};

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-md-surface-container-low">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <AnalyticsDashboard />
        <AnalyticsOpsLink />
      </div>
    </div>
  );
}
