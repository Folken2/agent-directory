import AnalyticsDashboard from '@/components/analytics/dashboard/AnalyticsDashboard';
import AnalyticsOpsLink from '@/components/analytics/AnalyticsOpsLink';
import { Page } from '@/components/layout/Page';

export const metadata = {
  title: 'Analytics | ADK Agent Directory',
  description: 'Directory traffic: visits, sources, pages, countries and crawlers.',
};

export default function AnalyticsPage() {
  return (
    <Page>
      <AnalyticsDashboard />
      <AnalyticsOpsLink />
    </Page>
  );
}
