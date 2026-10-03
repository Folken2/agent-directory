'use client';

import type { ReactNode } from 'react';
import { Check, Copy, Download, Save } from 'lucide-react';
import type { Blueprint } from '@/lib/blueprint/types';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-label-large uppercase tracking-wider text-md-on-surface-variant">{title}</h3>
      {children}
    </section>
  );
}

export default function BlueprintPanel({
  blueprint,
  copied,
  onCopy,
  onDownload,
  onSave,
}: {
  blueprint: Blueprint;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onSave: () => void;
}) {
  const bp = blueprint;
  return (
    <div className="space-y-6 px-3 pb-6">
      <div>
        <h2 className="text-headline-small text-md-on-surface">{bp.name}</h2>
        <p className="mt-2 text-body-medium text-md-on-surface-variant">{bp.goal}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onSave}>
          <Save /> Save blueprint
        </Button>
        <Button size="sm" variant="outlined" onClick={onCopy}>
          {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy as Markdown'}
        </Button>
        <Button size="sm" variant="outlined" onClick={onDownload}>
          <Download /> Download
        </Button>
      </div>

      <Section title="Agents">
        <ul className="space-y-3">
          {bp.agents.map((a) => (
            <li key={a.name} className="rounded-[var(--md-shape-lg)] bg-md-surface-container p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-md-on-surface">{a.name}</span>
                <Chip variant="category">{a.kind}</Chip>
                {a.model ? <span className="text-label-medium text-md-on-surface-variant">{a.model}</span> : null}
              </div>
              <p className="mt-2 text-body-medium text-md-on-surface-variant">{a.role}</p>
              {a.tools.length > 0 && (
                <p className="mt-2 text-label-medium text-md-on-surface-variant">Tools: {a.tools.join(', ')}</p>
              )}
              {a.subAgents.length > 0 && (
                <p className="mt-1 text-label-medium text-md-on-surface-variant">Sub-agents: {a.subAgents.join(', ')}</p>
              )}
            </li>
          ))}
        </ul>
      </Section>

      {bp.tools.length > 0 && (
        <Section title="Tools">
          <ul className="space-y-2 text-body-medium text-md-on-surface-variant">
            {bp.tools.map((t) => (
              <li key={t.name}>
                <span className="font-mono text-md-on-surface">{t.name}</span> <span className="text-label-medium">({t.kind})</span>: {t.purpose}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {bp.dataSources.length > 0 && (
        <Section title="Data sources">
          <ul className="space-y-2 text-body-medium text-md-on-surface-variant">
            {bp.dataSources.map((d) => (
              <li key={d.name}>
                <span className="text-md-on-surface">{d.name}</span>: {d.purpose}
                {d.access ? <span className="text-label-medium"> (access: {d.access})</span> : null}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {bp.models.length > 0 && (
        <Section title="Models">
          <ul className="space-y-2 text-body-medium text-md-on-surface-variant">
            {bp.models.map((m) => (
              <li key={m.model}>
                <span className="font-mono text-md-on-surface">{m.model}</span>
                {m.usedBy.length ? ` for ${m.usedBy.join(', ')}` : ''}: {m.reason}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {bp.risks.length > 0 && (
        <Section title="Risks">
          <ul className="list-disc space-y-1 pl-5 text-body-medium text-md-on-surface-variant">
            {bp.risks.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </Section>
      )}

      {bp.nextSteps.length > 0 && (
        <Section title="Next steps">
          <ol className="list-decimal space-y-1 pl-5 text-body-medium text-md-on-surface-variant">
            {bp.nextSteps.map((s) => <li key={s}>{s}</li>)}
          </ol>
        </Section>
      )}

      {bp.codeSkeleton && (
        <Section title="Code skeleton">
          <pre className="overflow-x-auto rounded-[var(--md-shape-md)] bg-md-surface-container-high p-4 font-mono text-[13px] text-md-on-surface">
            {bp.codeSkeleton}
          </pre>
        </Section>
      )}
    </div>
  );
}
