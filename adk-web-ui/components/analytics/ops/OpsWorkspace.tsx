'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { TIMELINE_RANGE_LABELS, type TimelineRange } from '@/lib/analytics/timeline-range';
import type { OpsInsights } from '@/lib/analytics/ops-types';
import { PageHeader } from '@/components/layout/Page';
import { panelClass } from '@/components/ui/card';
import RangeTabs from '@/components/analytics/dashboard/RangeTabs';
import DashboardSkeleton from '@/components/analytics/dashboard/DashboardSkeleton';
import AnalyticsOpsClient from '@/components/analytics/AnalyticsOpsClient';
import InsightsView from './InsightsView';
import ConversationsView from './ConversationsView';
import TranscriptSheet, { type TranscriptTarget } from './TranscriptSheet';

type Tab = 'insights' | 'conversations' | 'explorer';
const TABS: { id: Tab; label: string }[] = [
  { id: 'insights', label: 'Insights' },
  { id: 'conversations', label: 'Conversations' },
  { id: 'explorer', label: 'Explorer' },
];

type Loaded = { range: TimelineRange; data: OpsInsights | null; error: boolean };

/** The private ops page: one range control for every tab. */
export default function OpsWorkspace() {
  const [range, setRange] = useState<TimelineRange>('30');
  const [tab, setTab] = useState<Tab>('insights');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [transcript, setTranscript] = useState<TranscriptTarget>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/analytics/ops/insights?range=${range}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json) => {
        if (!cancelled) setLoaded({ range, data: json.data ?? null, error: false });
      })
      .catch(() => {
        // Keep the last good data on screen; flag the failure.
        if (!cancelled) setLoaded((prev) => ({ range, data: prev?.data ?? null, error: true }));
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const data = loaded?.data ?? null;
  const refreshing = loaded !== null && loaded.range !== range;
  const open = (appName: string, sessionId: string) => setTranscript({ appName, sessionId });

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (i + delta + TABS.length) % TABS.length;
    setTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Analytics', href: '/analytics' }, { label: 'Ops' }]}
        title="Ops"
        description={`Private. How conversations go, where the builder funnel leaks, and what people ask for · ${TIMELINE_RANGE_LABELS[range].toLowerCase()} · UTC`}
        actions={<RangeTabs value={range} onChange={setRange} />}
      />

      <div role="tablist" aria-label="Ops views" className="mb-6 flex gap-1 border-b border-md-outline/60 dark:border-md-outline-variant">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            role="tab"
            id={`ops-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`ops-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => onTabKey(e, i)}
            className={cn(
              '-mb-px border-b-2 px-4 pb-3 pt-1 text-label-large transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary',
              tab === t.id
                ? 'border-md-primary text-md-primary'
                : 'border-transparent text-md-on-surface-variant hover:text-md-on-surface'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`ops-panel-${tab}`} aria-labelledby={`ops-tab-${tab}`}>
        {tab === 'explorer' ? (
          <AnalyticsOpsClient range={range} />
        ) : loaded === null ? (
          <DashboardSkeleton />
        ) : !data ? (
          <div className={cn(panelClass, 'px-8 py-16 text-center text-body-medium text-md-on-surface-variant')}>
            Insights are unavailable right now.
          </div>
        ) : (
          <div className={cn('transition-opacity', refreshing && 'opacity-60')} aria-busy={refreshing}>
            {loaded.error ? (
              <p role="status" className="mb-4 text-body-medium text-md-error">
                Could not refresh; showing the last loaded range.
              </p>
            ) : null}
            {tab === 'insights' ? (
              <InsightsView data={data} onOpenConversation={open} />
            ) : (
              <ConversationsView rows={data.conversations} onOpen={open} />
            )}
          </div>
        )}
      </div>

      <p className="mt-10 text-body-small text-md-on-surface-variant">
        Topics, integrations and friction are keyword matches over message text; nothing is sent to a model.{' '}
        <Link href="/privacy" className="text-md-primary hover:underline">
          Privacy notice
        </Link>
      </p>

      <TranscriptSheet target={transcript} onClose={() => setTranscript(null)} />
    </>
  );
}
