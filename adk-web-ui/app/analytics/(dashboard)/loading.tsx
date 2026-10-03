import { Page } from '@/components/layout/Page';
import { PageHeaderSkeleton } from '@/components/layout/PageSkeletons';
import DashboardSkeleton from '@/components/analytics/dashboard/DashboardSkeleton';

export default function AnalyticsLoading() {
  return (
    <Page>
      <PageHeaderSkeleton />
      <DashboardSkeleton />
    </Page>
  );
}
