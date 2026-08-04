/**
 * Sessionizes page views into visits so we can ask whether a page leads
 * anywhere.
 *
 * Why `hashed_ip` and not a cookie: `ad_vid` only persists with analytics
 * consent, which on 2026-08-03 covered 40 of ~1,300 visitors. `hashed_ip` is
 * present on every human view and gives 61% multi-page coverage.
 *
 * This is a coarse session proxy, deliberately. Shared NAT merges several people
 * into one visit; a changing mobile IP splits one person into several. Good
 * enough to tell "this page is a dead end" from "this page starts journeys",
 * not good enough to count people.
 */

export const VISIT_GAP_MS = 30 * 60 * 1000;

export type RawPageView = {
  hashedIp: string;
  path: string;
  at: Date;
};

export type Visit = {
  hashedIp: string;
  startedAt: Date;
  endedAt: Date;
  /** Paths in chronological order, including immediate repeats. */
  paths: string[];
};

export type PageJourneyStat = {
  path: string;
  /** Times this path was viewed across all visits. */
  views: number;
  /** Times a visit started here. */
  entries: number;
  /** Times a visit ended here. */
  exits: number;
  /** Views followed by a *different* path in the same visit. */
  onward: number;
  /** onward / views, 0–1. Zero means nobody ever continued from here. */
  onwardRate: number;
  /** Visits where this was the only distinct path seen. */
  bounces: number;
};

/**
 * Groups views into visits: same hashed IP, gap under `gapMs`.
 * Input need not be sorted.
 */
export function sessionizeVisits(
  views: readonly RawPageView[],
  gapMs: number = VISIT_GAP_MS
): Visit[] {
  const sorted = [...views].sort((a, b) => {
    if (a.hashedIp !== b.hashedIp) return a.hashedIp < b.hashedIp ? -1 : 1;
    return a.at.getTime() - b.at.getTime();
  });

  const visits: Visit[] = [];
  let current: Visit | null = null;
  let lastAt = 0;

  for (const view of sorted) {
    const at = view.at.getTime();
    const continues =
      current !== null && current.hashedIp === view.hashedIp && at - lastAt <= gapMs;

    if (!continues) {
      current = {
        hashedIp: view.hashedIp,
        startedAt: view.at,
        endedAt: view.at,
        paths: [view.path],
      };
      visits.push(current);
    } else {
      current!.paths.push(view.path);
      current!.endedAt = view.at;
    }
    lastAt = at;
  }

  return visits;
}

/** Per-path journey behaviour across a set of visits. */
export function pageJourneyStats(visits: readonly Visit[]): PageJourneyStat[] {
  const acc = new Map<
    string,
    { views: number; entries: number; exits: number; onward: number; bounces: number }
  >();

  const bump = (path: string) => {
    let row = acc.get(path);
    if (!row) {
      row = { views: 0, entries: 0, exits: 0, onward: 0, bounces: 0 };
      acc.set(path, row);
    }
    return row;
  };

  for (const visit of visits) {
    const distinctPaths = new Set(visit.paths);
    const isBounce = distinctPaths.size === 1;

    visit.paths.forEach((path, index) => {
      const row = bump(path);
      row.views++;
      if (index === 0) row.entries++;
      if (index === visit.paths.length - 1) row.exits++;
      // "Onward" means they went somewhere else, not that they reloaded.
      if (visit.paths.slice(index + 1).some((next) => next !== path)) {
        row.onward++;
      }
    });

    if (isBounce) bump(visit.paths[0]).bounces++;
  }

  return [...acc.entries()]
    .map(([path, row]) => ({
      path,
      views: row.views,
      entries: row.entries,
      exits: row.exits,
      onward: row.onward,
      onwardRate: row.views > 0 ? row.onward / row.views : 0,
      bounces: row.bounces,
    }))
    .sort((a, b) => b.views - a.views);
}
