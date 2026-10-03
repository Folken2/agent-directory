import { Page } from '@/components/layout/Page';
import { ListSkeleton, PageHeaderSkeleton } from '@/components/layout/PageSkeletons';

export default function ChatHistoryLoading() {
  return (
    <Page>
      <div role="status" aria-label="Loading chat history">
        <PageHeaderSkeleton />
        <ListSkeleton rows={5} withAvatar />
      </div>
    </Page>
  );
}
