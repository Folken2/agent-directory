'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { getCatalogAgent } from '@/lib/agent-catalog-client';
import { TIMELINE_RANGE_LABELS, type TimelineRange } from '@/lib/analytics/timeline-range';
import { usePageviewStats } from '@/lib/analytics/use-pageview-stats';
import { cn } from '@/lib/utils';
import { panelClass } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/Page';
import DashboardSkeleton from './DashboardSkeleton';
import AnalyticsAgentCard from '@/components/analytics/AnalyticsAgentCard';
import BrandMark from '@/components/analytics/BrandMark';
import RangeTabs from './RangeTabs';
import StatTile from './StatTile';
import TrafficChart from './TrafficChart';
import RankedBars from './RankedBars';
import { formatCompact } from './format';

const PEOPLE = 'var(--chart-people)';
const CRAWLERS = 'var(--chart-crawlers)';
const MAX_COMPANIES = 6;

/** Agent pages read better with the catalog's display name than the slug. */
function pageName(path: string, fallback: string): string {
  const slug = /^\/agents\/([^/]+)$/.exec(path)?.[1];
  const agent = slug ? getCatalogAgent(decodeURIComponent(slug)) : null;
  return agent ? `Agent: ${agent.displayName || agent.name}` : fallback;
}

function Panel({ title, subtitle, children, className }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn(panelClass, 'p-5 sm:p-6', className)} aria-label={title}>
      <h2 className="text-title-medium text-md-on-surface">{title}</h2>
      {subtitle ? <p className="mt-0.5 text-body-small text-md-on-surface-variant">{subtitle}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function AnalyticsDashboard() {
  const [range, setRange] = useState<TimelineRange>('30');
  const { stats, loaded } = usePageviewStats(range);
  const days = range === 'all' ? null : Number(range);
  const periodLabel = days ? `prior ${days} days` : undefined;
  const prev = stats?.previous ?? null;

  const header = (
    <PageHeader
      title="Analytics"
      description={`Who reads the directory: people and crawlers · ${TIMELINE_RANGE_LABELS[range].toLowerCase()} · UTC`}
      actions={<RangeTabs value={range} onChange={setRange} />}
    />
  );

  if (!stats) {
    return (
      <>
        {header}
        {loaded ? (
          <div className={cn(panelClass, 'px-8 py-16 text-center')}>
            <p className="mb-2 text-title-medium text-md-on-surface">No visits yet</p>
            <p className="mx-auto max-w-sm text-body-medium text-md-on-surface-variant">
              Counts appear here once the database is connected and the directory starts receiving traffic.
            </p>
          </div>
        ) : (
          <DashboardSkeleton />
        )}
      </>
    );
  }

  const timeline = stats.timeline ?? [];
  const companies = stats.botCompanies ?? [];
  const aiCompanies = companies.filter((c) => c.ai).length;
  const visits = stats.visits ?? stats.humans;

  return (
    <>
      {header}
      {/* Refetch keeps the frame: dim the previous render instead of a skeleton. */}
      <div className={cn('space-y-4 transition-opacity', !loaded && 'opacity-60')} aria-busy={!loaded}>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatTile
            hero
            className="col-span-2 lg:col-span-1"
            label="Visits"
            hint="page views by people"
            value={visits}
            previous={prev?.visits}
            periodLabel={periodLabel}
            trend={timeline.map((d) => d.humans)}
            trendColor={PEOPLE}
          />
          <StatTile label="People" hint="approx., by IP" value={stats.peopleApprox ?? 0} previous={prev?.peopleApprox} periodLabel={periodLabel} />
          <StatTile label="Returning visitors" value={stats.returning ?? 0} previous={prev?.returning} periodLabel={periodLabel} />
          <StatTile
            label="Crawler hits"
            value={stats.bots}
            previous={prev?.bots}
            periodLabel={periodLabel}
            upIsGood={null}
            trend={timeline.map((d) => d.bots)}
            trendColor={CRAWLERS}
          />
        </div>

        <Panel title="Daily traffic" subtitle="Page views by people vs. crawler hits">
          <TrafficChart timeline={timeline} />
        </Panel>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Top pages" subtitle={`Share of ${formatCompact(visits)} visits`}>
            <RankedBars
              color={PEOPLE}
              empty="No page views in this period."
              rows={(stats.topPages ?? []).map((p) => ({
                ...p,
                title: p.id === 'other' ? undefined : p.id,
                label: <span className="truncate">{pageName(p.id, p.label)}</span>,
              }))}
            />
          </Panel>
          <Panel title="Sources" subtitle="Where people came from (referring site)">
            <RankedBars
              color={PEOPLE}
              empty="No visits in this period."
              rows={(stats.topSources ?? []).map((s) => ({ ...s, label: <span className="truncate">{s.label}</span> }))}
            />
          </Panel>
          <Panel title="Countries" subtitle="Top countries by visits">
            <RankedBars
              color={PEOPLE}
              empty="No visits with location data in this period."
              rows={(stats.topCountries ?? []).map((c) => ({
                id: c.country,
                count: c.count,
                share: c.share,
                label: (
                  <>
                    <span aria-hidden>{c.flag}</span>
                    <span className="truncate">{c.name}</span>
                  </>
                ),
              }))}
            />
          </Panel>
          <Panel title="Devices" subtitle="Visits by device type">
            <RankedBars
              color={PEOPLE}
              empty="No visits in this period."
              rows={(stats.devices ?? []).map((d) => ({ ...d, label: <span>{d.label}</span> }))}
            />
          </Panel>
          <Panel
            title="Crawlers by company"
            subtitle={`${formatCompact(stats.bots)} hits${aiCompanies ? ` · ${aiCompanies} AI ${aiCompanies === 1 ? 'company' : 'companies'}` : ''}`}
          >
            <RankedBars
              color={CRAWLERS}
              empty="No crawlers in this period."
              rows={companies.slice(0, MAX_COMPANIES).map((c) => ({
                id: c.id,
                count: c.count,
                share: c.share,
                label: (
                  <>
                    <BrandMark id={c.id} name={c.name} color={c.color} domain={c.domain} size={20} />
                    <span className="truncate">{c.name}</span>
                  </>
                ),
                meta: c.agents
                  .slice(0, 3)
                  .map((a) => `${a.botName} · ${a.purposeLabel}`)
                  .join('  ·  '),
              }))}
            />
            {companies.length > MAX_COMPANIES ? (
              <p className="mt-4 text-label-medium text-md-on-surface-variant">
                +{companies.length - MAX_COMPANIES} smaller {companies.length - MAX_COMPANIES === 1 ? 'operator' : 'operators'}
              </p>
            ) : null}
          </Panel>
          <Panel title="Agents people use" subtitle="Messages and time in chat, after analytics consent">
            {(stats.topAgents ?? []).length === 0 ? (
              <p className="text-body-medium text-md-on-surface-variant">
                No consented chat activity in this period. Visit counts still include everyone.
              </p>
            ) : (
              <div className="grid gap-3">
                {stats.topAgents.map((a) => (
                  <AnalyticsAgentCard key={a.agentSlug} agent={a} catalogAgent={getCatalogAgent(a.agentSlug)} />
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
