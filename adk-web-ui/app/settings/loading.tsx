import { Page } from '@/components/layout/Page';
import { ListSkeleton, PageHeaderSkeleton } from '@/components/layout/PageSkeletons';

export default function SettingsLoading() {
  return (
    <Page>
      <div role="status" aria-label="Loading settings">
        <PageHeaderSkeleton />
        <ListSkeleton rows={3} />
      </div>
    </Page>
  );
}
