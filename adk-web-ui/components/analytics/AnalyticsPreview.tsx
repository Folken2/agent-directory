'use client';

import type {
  BotCompanyStat,
  CountryStat,
} from '@/lib/analytics/stats';
import BrandMark from '@/components/analytics/BrandMark';
import VisitsTimeline from '@/components/analytics/VisitsTimeline';
import { usePageviewStats } from '@/lib/analytics/use-pageview-stats';

/** Companies shown before the tail is collapsed into a count. */
const MAX_COMPANIES = 8;

function formatCount(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function formatCompact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function formatShare(share: number): string {
  if (share > 0 && share < 0.1) return '<0.1%';
  return `${share % 1 === 0 ? share.toFixed(0) : share.toFixed(1)}%`;
}

function Bar({ width, tint }: { width: number; tint?: string }) {
  return (
    <div className="h-px bg-md-outline overflow-hidden">
      <div
        className="h-full transition-[width] duration-500 ease-out"
        style={{
          width: `${Math.max(width, 2)}%`,
          backgroundColor: tint ?? 'hsl(var(--md-primary) / 0.7)',
        }}
      />
    </div>
  );
}

function CountryRow({ country, max }: { country: CountryStat; max: number }) {
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <div className="min-w-0 flex items-baseline gap-2.5">
          <span className="text-base leading-none" aria-hidden>
            {country.flag}
          </span>
          <span className="text-title-medium text-md-on-surface truncate">
            {country.name}
          </span>
          <span className="text-label-small text-md-on-surface-variant/50 shrink-0 tabular-nums">
            {formatShare(country.share)}
          </span>
        </div>
        <span className="text-label-large text-md-on-surface-variant tabular-nums shrink-0">
          {formatCount(country.count)}
        </span>
      </div>
      <Bar width={(country.count / max) * 100} />
    </li>
  );
}

function CompanyRow({ company, max }: { company: BotCompanyStat; max: number }) {
  const agents = company.agents.slice(0, 4);

  return (
    <li className="py-3.5 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-4 mb-2">
        <div className="min-w-0 flex items-center gap-3">
          <BrandMark
            id={company.id}
            name={company.name}
            color={company.color}
            domain={company.domain}
            size={28}
          />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-title-medium text-md-on-surface truncate">
                {company.name}
              </span>
              <span className="text-label-small text-md-on-surface-variant/50 shrink-0 tabular-nums">
                {formatShare(company.share)}
              </span>
            </div>
            <p className="text-label-small text-md-on-surface-variant/70 truncate">
              {agents
                .map((a) => `${a.botName} · ${a.purposeLabel}`)
                .join('  ·  ')}
              {company.agents.length > agents.length
                ? ` +${company.agents.length - agents.length}`
                : ''}
            </p>
          </div>
        </div>
        <span className="text-label-large text-md-on-surface-variant tabular-nums shrink-0">
          {formatCount(company.count)}
        </span>
      </div>
      <Bar width={(company.count / max) * 100} tint={company.color} />
    </li>
  );
}

export default function AnalyticsPreview() {
  const { stats, loaded } = usePageviewStats();

  if (!loaded) {
    return (
      <div className="h-40 flex items-center justify-center">
        <p className="text-body-medium text-md-on-surface-variant">Loading…</p>
      </div>
    );
  }

  if (!stats || stats.total <= 0) {
    return (
      <div className="bg-md-surface-container elevation-1 rounded-2xl px-8 py-16 text-center">
        <p className="text-title-medium text-md-on-surface mb-2">No visits yet</p>
        <p className="text-body-medium text-md-on-surface-variant max-w-sm mx-auto">
          Counts appear here once Neon is connected and the directory starts receiving traffic.
        </p>
      </div>
    );
  }

  const topCountries = stats.topCountries ?? [];
  const allCompanies = stats.botCompanies ?? [];
  const botCompanies = allCompanies.slice(0, MAX_COMPANIES);
  const maxCountry = topCountries[0]?.count || 1;
  const maxCompany = botCompanies[0]?.count || 1;
  const humanPct = Math.round((stats.humans / stats.total) * 100);
  const aiCompanies = allCompanies.filter((c) => c.ai).length;
  const hiddenCompanies = allCompanies.length - botCompanies.length;

  return (
    <div className="space-y-10">
      <div className="bg-md-surface-container elevation-1 rounded-2xl px-8 py-10 text-center">
        <p className="text-label-small uppercase tracking-widest text-md-on-surface-variant/60 mb-3">
          Total visits
        </p>
        <p className="text-display-medium sm:text-display-large font-bold text-md-on-surface tracking-tight tabular-nums">
          {formatCompact(stats.total)}
        </p>
        <p className="mt-4 text-body-medium text-md-on-surface-variant">
          {humanPct}% human · {formatCompact(stats.bots)} bots
        </p>
      </div>

      {stats.timeline?.length ? <VisitsTimeline timeline={stats.timeline} /> : null}

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-md-surface elevation-1 rounded-xl p-6 sm:p-8">
          <h2 className="text-title-medium text-md-on-surface mb-1">Top countries</h2>
          <p className="text-body-small text-md-on-surface-variant mb-6">
            Human visits · {formatCompact(stats.humans)} total
          </p>
          {topCountries.length === 0 ? (
            <p className="text-body-small text-md-on-surface-variant">
              No human visits with geo data yet.
            </p>
          ) : (
            <ul>
              {topCountries.map((c) => (
                <CountryRow key={c.country} country={c} max={maxCountry} />
              ))}
            </ul>
          )}
        </section>

        <section className="bg-md-surface elevation-1 rounded-xl p-6 sm:p-8">
          <h2 className="text-title-medium text-md-on-surface mb-1">Crawlers by company</h2>
          <p className="text-body-small text-md-on-surface-variant mb-6">
            {formatCompact(stats.bots)} crawls
            {aiCompanies > 0
              ? ` · ${aiCompanies} AI ${aiCompanies === 1 ? 'company' : 'companies'}`
              : ''}
          </p>
          {botCompanies.length === 0 ? (
            <p className="text-body-small text-md-on-surface-variant">
              No crawlers recorded yet.
            </p>
          ) : (
            <>
              <ul>
                {botCompanies.map((c) => (
                  <CompanyRow key={c.id} company={c} max={maxCompany} />
                ))}
              </ul>
              {hiddenCompanies > 0 ? (
                <p className="mt-4 text-label-small text-md-on-surface-variant/60">
                  +{hiddenCompanies} smaller{' '}
                  {hiddenCompanies === 1 ? 'operator' : 'operators'}
                </p>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
