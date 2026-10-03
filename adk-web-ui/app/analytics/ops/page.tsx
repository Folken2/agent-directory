import { Page } from '@/components/layout/Page';
import OpsWorkspace from '@/components/analytics/ops/OpsWorkspace';

export const metadata = {
  title: 'Ops | ADK Agent Directory',
  robots: { index: false, follow: false },
};

// Access is checked in layout.tsx.
export default function AnalyticsOpsPage() {
  return (
    <Page>
      <OpsWorkspace />
    </Page>
  );
}
