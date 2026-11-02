import AnalyticsDashboard from '@/components/analytics/dashboard/AnalyticsDashboard';
import AnalyticsOpsLink from '@/components/analytics/AnalyticsOpsLink';
import { Page } from '@/components/layout/Page';

export const metadata = {
  title: 'Analytics | ADK Agent Directory',
  description: 'Directory traffic: visits, sources, pages, countries and crawlers.',
  robots: { index: false, follow: false },
};

// Access is checked in app/analytics/layout.tsx.

export default function AnalyticsPage() {
  return (
    <Page>
      <AnalyticsDashboard />
      <AnalyticsOpsLink />
    </Page>
  );
}
