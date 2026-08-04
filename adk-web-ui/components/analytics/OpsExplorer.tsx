'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type {
  AgentUsageRow,
  MissingPathRow,
  PageUsageRow,
  PromptTheme,
  PromptThemes,
  TrafficQuality,
} from '@/lib/analytics/ops-types';
import type { TimelineRange } from '@/lib/analytics/timeline-range';
import { TIMELINE_RANGE_LABELS, TIMELINE_RANGES } from '@/lib/analytics/timeline-range';
import { formatAgentDisplayName } from '@/lib/agent-utils';
import OpsTable, { type OpsTableColumn } from '@/components/analytics/OpsTable';

type Tab = 'agents' | 'pages' | 'prompts' | 'traffic';

type RawPrompt = { agentSlug: string; text: string };

type Props = {
  range: TimelineRange;
  onRangeChange: (range: TimelineRange) => void;
  agents: AgentUsageRow[];
  pages: PageUsageRow[];
  missing: MissingPathRow[];
  quality: TrafficQuality;
  themes: PromptThemes;
};

function formatCount(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function ThemeList({ themes }: { themes: PromptTheme[] }) {
  if (themes.length === 0) {
    return (
      <p className="text-body-small text-md-on-surface-variant">
        No themes above the minimum threshold.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {themes.map((t) => (
        <li
          key={t.term}
          className="flex items-baseline justify-between gap-4 text-sm"
        >
          <span className="text-md-on-surface font-medium">&ldquo;{t.term}&rdquo;</span>
          <span className="text-md-on-surface-variant tabular-nums shrink-0">
            {t.prompts} prompts · {t.agents.map((a) => a.agentSlug).slice(0, 3).join(', ')}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function OpsExplorer({
  range,
  onRangeChange,
  agents,
  pages,
  missing,
  quality,
  themes,
}: Props) {
  const [tab, setTab] = useState<Tab>('agents');
  const [rawMode, setRawMode] = useState(false);
  const [rawPrompts, setRawPrompts] = useState<RawPrompt[]>([]);
  const [rawTotal, setRawTotal] = useState(0);
  const [rawLoading, setRawLoading] = useState(false);

  const loadRaw = useCallback(async () => {
    setRawLoading(true);
    try {
      const res = await fetch(
        `/api/analytics/ops/prompts?range=${range}&mode=raw&limit=50`,
        { cache: 'no-store' }
      );
      if (!res.ok) {
        setRawPrompts([]);
        setRawTotal(0);
        return;
      }
      const data = await res.json();
      setRawPrompts(data.prompts ?? []);
      setRawTotal(data.total ?? 0);
    } finally {
      setRawLoading(false);
    }
  }, [range]);

  useEffect(() => {
    if (rawMode && tab === 'prompts') {
      void loadRaw();
    }
  }, [rawMode, tab, loadRaw]);

  const agentCols: OpsTableColumn<AgentUsageRow>[] = useMemo(
    () => [
      {
        key: 'agent',
        header: 'Agent',
        sortValue: (r) => r.agentSlug,
        render: (r) => (
          <Link
            href={`/agents/${r.agentSlug}`}
            className="text-md-primary hover:underline"
          >
            {formatAgentDisplayName(r.agentSlug)}
          </Link>
        ),
      },
      {
        key: 'runs',
        header: 'Runs',
        align: 'right',
        sortValue: (r) => r.runs,
        render: (r) => formatCount(r.runs),
      },
      {
        key: 'errors',
        header: 'Errors',
        align: 'right',
        sortValue: (r) => r.errors,
        render: (r) => `${r.errors} (${pct(r.errorRate)})`,
      },
      {
        key: 'views',
        header: 'Page views',
        align: 'right',
        sortValue: (r) => r.pageViews,
        render: (r) => formatCount(r.pageViews),
      },
      {
        key: 'prompts',
        header: 'Prompts',
        align: 'right',
        sortValue: (r) => r.prompts,
        render: (r) => formatCount(r.prompts),
      },
      {
        key: 'last',
        header: 'Last run',
        sortValue: (r) => r.lastRunAt,
        render: (r) => (r.lastRunAt ? r.lastRunAt.slice(0, 10) : '—'),
      },
    ],
    []
  );

  const pageCols: OpsTableColumn<PageUsageRow>[] = useMemo(
    () => [
      {
        key: 'path',
        header: 'Path',
        sortValue: (r) => r.path,
        render: (r) => (
          <Link href={r.path} className="text-md-primary hover:underline font-mono text-xs">
            {r.path}
          </Link>
        ),
      },
      {
        key: 'views',
        header: 'Human views',
        align: 'right',
        sortValue: (r) => r.humanViews,
        render: (r) => formatCount(r.humanViews),
      },
      {
        key: 'visitors',
        header: 'Visitors',
        align: 'right',
        sortValue: (r) => r.visitors,
        render: (r) => formatCount(r.visitors),
      },
      {
        key: 'entries',
        header: 'Entries',
        align: 'right',
        sortValue: (r) => r.entries,
        render: (r) => formatCount(r.entries),
      },
      {
        key: 'onward',
        header: 'Onward',
        align: 'right',
        sortValue: (r) => r.onwardRate,
        render: (r) => pct(r.onwardRate),
      },
      {
        key: 'bounces',
        header: 'Bounces',
        align: 'right',
        sortValue: (r) => r.bounces,
        render: (r) => formatCount(r.bounces),
      },
    ],
    []
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: 'agents', label: 'Agents' },
    { id: 'pages', label: 'Pages' },
    { id: 'prompts', label: 'Prompts' },
    { id: 'traffic', label: 'Traffic' },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-title-medium text-md-on-surface">Explorer</h2>
          <p className="text-body-small text-md-on-surface-variant">
            Filterable tables for keep / kill / add decisions
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {TIMELINE_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRangeChange(r)}
              className={`rounded-lg px-3 py-1.5 text-label-small ${
                range === r
                  ? 'bg-md-primary text-md-on-primary'
                  : 'text-md-on-surface-variant hover:bg-md-surface-container'
              }`}
            >
              {TIMELINE_RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-md-outline/30 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-label-medium ${
              tab === t.id
                ? 'bg-md-surface-container text-md-on-surface'
                : 'text-md-on-surface-variant hover:text-md-on-surface'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'agents' && (
        <OpsTable
          rows={agents}
          columns={agentCols}
          rowKey={(r) => r.agentSlug}
          filterPlaceholder="Filter agents…"
          filterText={(r) => `${r.agentSlug} ${formatAgentDisplayName(r.agentSlug)}`}
        />
      )}

      {tab === 'pages' && (
        <OpsTable
          rows={pages}
          columns={pageCols}
          rowKey={(r) => r.path}
          filterPlaceholder="Filter paths…"
          filterText={(r) => r.path}
        />
      )}

      {tab === 'prompts' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRawMode(false)}
              className={`text-label-small px-2.5 py-1 rounded-md ${
                !rawMode
                  ? 'bg-md-surface-container text-md-on-surface'
                  : 'text-md-on-surface-variant'
              }`}
            >
              Themes
            </button>
            <button
              type="button"
              onClick={() => setRawMode(true)}
              className={`text-label-small px-2.5 py-1 rounded-md ${
                rawMode
                  ? 'bg-md-surface-container text-md-on-surface'
                  : 'text-md-on-surface-variant'
              }`}
            >
              Raw text
            </button>
          </div>
          {!rawMode ? (
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-label-medium text-md-on-surface mb-3">
                  Bigrams
                </h3>
                <ThemeList themes={themes.bigrams} />
              </div>
              <div>
                <h3 className="text-label-medium text-md-on-surface mb-3">
                  Unigrams
                </h3>
                <ThemeList themes={themes.unigrams} />
              </div>
              <p className="md:col-span-2 text-label-small text-md-on-surface-variant">
                {themes.distinctOrganicPrompts} distinct organic ·{' '}
                {themes.samplePrompts} catalog samples excluded
              </p>
            </div>
          ) : rawLoading ? (
            <p className="text-body-small text-md-on-surface-variant">Loading…</p>
          ) : (
            <div className="space-y-2">
              <p className="text-label-small text-md-on-surface-variant">
                Showing {rawPrompts.length} of {rawTotal} organic prompts
              </p>
              <ul className="space-y-2 max-h-[28rem] overflow-y-auto">
                {rawPrompts.map((p, i) => (
                  <li
                    key={`${p.agentSlug}-${i}`}
                    className="rounded-lg border border-md-outline/30 px-3 py-2 text-sm"
                  >
                    <Link
                      href={`/agents/${p.agentSlug}`}
                      className="text-label-small text-md-primary hover:underline"
                    >
                      {p.agentSlug}
                    </Link>
                    <p className="text-md-on-surface mt-1 whitespace-pre-wrap">
                      {p.text.length > 400 ? `${p.text.slice(0, 400)}…` : p.text}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === 'traffic' && (
        <div className="space-y-6">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(
              [
                ['Total views', quality.totalViews],
                ['Page views', quality.pageViews],
                ['Human pages', quality.humanPageViews],
                ['Scanner views', quality.scannerViews],
                ['Spoofed scans', quality.spoofedScannerViews],
                ['Missing', quality.missingViews],
                ['Infra', quality.infraViews],
                ['Bot pages', quality.botPageViews],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-label-small text-md-on-surface-variant mb-1">
                  {label}
                </dt>
                <dd className="text-title-medium tabular-nums">
                  {formatCount(value)}
                </dd>
              </div>
            ))}
          </dl>
          <div>
            <h3 className="text-label-medium text-md-on-surface mb-3">
              Missing paths (repeat demand)
            </h3>
            {missing.length === 0 ? (
              <p className="text-body-small text-md-on-surface-variant">
                No missing paths with traffic in this range.
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {missing.slice(0, 25).map((m) => (
                  <li
                    key={m.path}
                    className="flex justify-between gap-4 font-mono text-xs"
                  >
                    <span>{m.path}</span>
                    <span className="text-md-on-surface-variant tabular-nums">
                      {m.hits} hits · {m.visitors} visitors
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
