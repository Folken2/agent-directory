import { ArrowUp, Copy, Download, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { panelClass } from '@/components/ui/card';

/**
 * The site's story in three steps, each with a small drawing of the real UI
 * (composer, builder chat, blueprint). Used on Home and About.
 */

function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      className="flex h-44 items-center justify-center overflow-hidden rounded-[var(--md-shape-md)] bg-md-surface-container-low px-5 dark:bg-md-surface"
    >
      {children}
    </div>
  );
}

function DescribeDrawing() {
  return (
    <Stage>
      <div className="w-full max-w-[260px] space-y-3">
        <div className="flex items-center gap-2 rounded-full border border-md-outline/70 bg-md-surface py-1.5 pl-4 pr-1.5 shadow-sm dark:bg-md-surface-container">
          <span className="flex-1 truncate text-[12px] text-md-on-surface">An agent that triages support email</span>
          <span className="flex size-6 items-center justify-center rounded-full bg-md-primary text-md-on-primary">
            <ArrowUp className="size-3.5" />
          </span>
        </div>
        <div className="flex justify-center gap-1.5">
          {['Research', 'Data analysis', 'Pipeline'].map((c) => (
            <span key={c} className="rounded-full border border-md-outline/60 bg-md-surface px-2 py-0.5 text-[10px] text-md-on-surface-variant dark:bg-md-surface-container">
              {c}
            </span>
          ))}
        </div>
      </div>
    </Stage>
  );
}

function Node({ children, primary = false }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <span
      className={cn(
        'rounded-[6px] px-2 py-1 text-[10px] font-medium',
        primary ? 'bg-md-primary-container text-md-on-primary-container' : 'border border-md-outline/70 bg-md-surface text-md-on-surface dark:bg-md-surface-container'
      )}
    >
      {children}
    </span>
  );
}

function DesignDrawing() {
  return (
    <Stage>
      <div className="w-full max-w-[260px] space-y-2">
        <div className="ml-auto w-fit max-w-[80%] rounded-2xl bg-md-surface-container px-3 py-1.5 text-[11px] text-md-on-surface">
          Refunds go to a person
        </div>
        <div className="rounded-2xl px-1 text-[11px] text-md-on-surface-variant">Here&apos;s a design with three agents:</div>
        <div className="flex flex-col items-center gap-1.5">
          <Node primary>Coordinator</Node>
          <svg width="120" height="12" viewBox="0 0 120 12" className="text-md-outline" fill="none">
            <path d="M60 0v4M60 4H24v8M60 4h36v8" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <div className="flex gap-3">
            <Node>Triage</Node>
            <Node>Reply drafter</Node>
          </div>
        </div>
      </div>
    </Stage>
  );
}

function BlueprintDrawing() {
  return (
    <Stage>
      <div className="w-full max-w-[220px] rounded-[var(--md-shape-sm)] border border-md-outline/70 bg-md-surface p-3 shadow-sm dark:bg-md-surface-container">
        <p className="text-[11px] font-medium text-md-on-surface">Support triage agent</p>
        <dl className="mt-2 space-y-1 text-[10px]">
          {[
            ['Agents', '3'],
            ['Tools', 'Gmail, Help center'],
            ['Prompts', 'Drafted'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2 border-t border-md-outline/50 pt-1">
              <dt className="text-md-on-surface-variant">{k}</dt>
              <dd className="truncate text-md-on-surface">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-2.5 flex gap-1.5">
          <span className="flex items-center gap-1 rounded-full bg-md-primary px-2 py-0.5 text-[9px] font-medium text-md-on-primary">
            <Save className="size-2.5" /> Save
          </span>
          <span className="flex items-center gap-1 rounded-full border border-md-outline/70 px-2 py-0.5 text-[9px] text-md-primary">
            <Copy className="size-2.5" /> Copy
          </span>
          <span className="flex items-center gap-1 rounded-full border border-md-outline/70 px-2 py-0.5 text-[9px] text-md-primary">
            <Download className="size-2.5" />
          </span>
        </div>
      </div>
    </Stage>
  );
}

const STEPS = [
  {
    title: 'Describe it',
    body: 'Say what the agent should do, in your own words. One sentence is enough to start.',
    Drawing: DescribeDrawing,
  },
  {
    title: 'Design it together',
    body: 'The builder asks a few questions, then proposes the agents, tools and prompts, and explains why.',
    Drawing: DesignDrawing,
  },
  {
    title: 'Take the blueprint',
    body: 'The design collects in a blueprint. Copy it, download it, or save it to get help building it.',
    Drawing: BlueprintDrawing,
  },
] as const;

export default function HowItWorks() {
  return (
    <ol className="grid gap-4 md:grid-cols-3">
      {STEPS.map(({ title, body, Drawing }, i) => (
        <li key={title} className={cn(panelClass, 'p-3 pb-5')}>
          <Drawing />
          <div className="px-2 pt-5">
            <p className="text-label-large text-md-primary">Step {i + 1}</p>
            <h3 className="mt-1 text-title-large tracking-tight text-md-on-surface">{title}</h3>
            <p className="mt-2 text-body-medium text-md-on-surface-variant">{body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
