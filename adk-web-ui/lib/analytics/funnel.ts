/**
 * Goal funnel for `/analytics/ops`: landing page → agent chat opened →
 * builder started → build emailed → contact click, each step credited to the
 * page the visit landed on.
 *
 * Visits come from sessionized page views (every human visit, JS or not);
 * steps come from first-party engagement events, which carry the landing page
 * and a random visit key from the browser. Each step counts a visit once.
 * Steps are not strictly sequential: someone can click Contact without ever
 * opening a chat, so each rate is "share of landing visits", not step-to-step.
 */

export type FunnelStepId = 'chat' | 'builder' | 'emailed' | 'contact';

export const FUNNEL_STEPS: { id: FunnelStepId; label: string }[] = [
  { id: 'chat', label: 'Agent chat opened' },
  { id: 'builder', label: 'Builder started' },
  { id: 'emailed', label: 'Build emailed' },
  { id: 'contact', label: 'Contact click' },
];

const UNKNOWN_LANDING = '(unknown)';

export function funnelStepFor(eventType: string): FunnelStepId | null {
  if (eventType === 'agent_open' || eventType === 'try_agent') return 'chat';
  if (eventType === 'builder_start') return 'builder';
  if (eventType === 'build_emailed') return 'emailed';
  if (eventType === 'contact_click' || /^contact_[a-z]+$/.test(eventType)) return 'contact';
  return null;
}

export type FunnelEvent = {
  eventType: string;
  /** Page the event fired on. */
  path: string;
  landing: string | null;
  /** Visit key, or another per-visit id when the browser sent none. */
  visit: string;
};

export type FunnelCounts = Record<FunnelStepId, number>;

export type FunnelRow = { landing: string; visits: number } & FunnelCounts;

export type GuideFunnelRow = {
  path: string;
  views: number;
  tryAgent: number;
  builderStart: number;
  contactClick: number;
};

export type GoalFunnel = {
  totals: FunnelRow;
  byLanding: FunnelRow[];
  guides: GuideFunnelRow[];
};

function emptyCounts(): FunnelCounts {
  return { chat: 0, builder: 0, emailed: 0, contact: 0 };
}

export function isGuidePath(path: string): boolean {
  return /^\/guides\/[^/]+$/.test(path);
}

/** Share of `of`, 0–1; 0 when there is nothing to divide by. */
export function funnelRate(count: number, of: number): number {
  return of > 0 ? count / of : 0;
}

export function buildGoalFunnel(input: {
  /** Landing path of each visit. */
  visitLandings: readonly string[];
  events: readonly FunnelEvent[];
  /** Human page views per path, for the guide rows. */
  pageViews: ReadonlyMap<string, number>;
  /** Most landing rows shown; the rest stay in the totals. */
  limit?: number;
}): GoalFunnel {
  const visitsByLanding = new Map<string, number>();
  for (const landing of input.visitLandings) {
    visitsByLanding.set(landing, (visitsByLanding.get(landing) ?? 0) + 1);
  }

  // step → landing → visit keys
  const seen = new Map<FunnelStepId, Map<string, Set<string>>>();
  const totalSeen = new Map<FunnelStepId, Set<string>>();
  // guide path → event type → visit keys (credited by landing or by where it fired)
  const guideSeen = new Map<string, Map<string, Set<string>>>();

  for (const e of input.events) {
    const landing = e.landing || UNKNOWN_LANDING;
    const step = funnelStepFor(e.eventType);
    if (step) {
      let byLanding = seen.get(step);
      if (!byLanding) seen.set(step, (byLanding = new Map()));
      let visits = byLanding.get(landing);
      if (!visits) byLanding.set(landing, (visits = new Set()));
      visits.add(e.visit);
      let all = totalSeen.get(step);
      if (!all) totalSeen.set(step, (all = new Set()));
      all.add(e.visit);
    }

    const guideKey = e.eventType === 'try_agent' || e.eventType === 'builder_start' || e.eventType === 'contact_click'
      ? e.eventType
      : null;
    if (!guideKey) continue;
    for (const guide of new Set([landing, e.path].filter(isGuidePath))) {
      let byType = guideSeen.get(guide);
      if (!byType) guideSeen.set(guide, (byType = new Map()));
      let visits = byType.get(guideKey);
      if (!visits) byType.set(guideKey, (visits = new Set()));
      visits.add(e.visit);
    }
  }

  const landings = new Set<string>(visitsByLanding.keys());
  for (const byLanding of seen.values()) for (const l of byLanding.keys()) landings.add(l);

  const byLanding: FunnelRow[] = [...landings].map((landing) => {
    const counts = emptyCounts();
    for (const { id } of FUNNEL_STEPS) counts[id] = seen.get(id)?.get(landing)?.size ?? 0;
    return { landing, visits: visitsByLanding.get(landing) ?? 0, ...counts };
  });
  byLanding.sort(
    (a, b) =>
      b.visits - a.visits ||
      b.contact + b.emailed + b.builder + b.chat - (a.contact + a.emailed + a.builder + a.chat) ||
      a.landing.localeCompare(b.landing)
  );

  const totals: FunnelRow = { landing: 'All landings', visits: input.visitLandings.length, ...emptyCounts() };
  for (const { id } of FUNNEL_STEPS) totals[id] = totalSeen.get(id)?.size ?? 0;

  const guidePaths = new Set<string>([...guideSeen.keys()]);
  for (const path of input.pageViews.keys()) if (isGuidePath(path)) guidePaths.add(path);
  const guides: GuideFunnelRow[] = [...guidePaths]
    .map((path) => {
      const byType = guideSeen.get(path);
      return {
        path,
        views: input.pageViews.get(path) ?? 0,
        tryAgent: byType?.get('try_agent')?.size ?? 0,
        builderStart: byType?.get('builder_start')?.size ?? 0,
        contactClick: byType?.get('contact_click')?.size ?? 0,
      };
    })
    .sort((a, b) => b.views - a.views || a.path.localeCompare(b.path));

  return { totals, byLanding: byLanding.slice(0, input.limit ?? 25), guides };
}
