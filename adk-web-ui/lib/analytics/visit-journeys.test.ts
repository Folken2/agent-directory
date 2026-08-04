import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  VISIT_GAP_MS,
  pageJourneyStats,
  sessionizeVisits,
  type RawPageView,
} from './visit-journeys';

const base = new Date('2026-08-01T10:00:00.000Z').getTime();
const view = (hashedIp: string, path: string, offsetMs: number): RawPageView => ({
  hashedIp,
  path,
  at: new Date(base + offsetMs),
});

const MIN = 60 * 1000;

describe('sessionizeVisits', () => {
  it('returns nothing for no views', () => {
    assert.deepEqual(sessionizeVisits([]), []);
  });

  it('groups views from one IP within the gap into one visit', () => {
    const visits = sessionizeVisits([
      view('ip1', '/', 0),
      view('ip1', '/about', 2 * MIN),
      view('ip1', '/trending', 5 * MIN),
    ]);
    assert.equal(visits.length, 1);
    assert.deepEqual(visits[0].paths, ['/', '/about', '/trending']);
    assert.equal(visits[0].startedAt.getTime(), base);
    assert.equal(visits[0].endedAt.getTime(), base + 5 * MIN);
  });

  it('splits into a new visit once the gap is exceeded', () => {
    const visits = sessionizeVisits([
      view('ip1', '/', 0),
      view('ip1', '/about', 31 * MIN),
    ]);
    assert.equal(visits.length, 2);
    assert.deepEqual(visits[0].paths, ['/']);
    assert.deepEqual(visits[1].paths, ['/about']);
  });

  it('treats a gap exactly at the boundary as the same visit', () => {
    const visits = sessionizeVisits([
      view('ip1', '/', 0),
      view('ip1', '/about', VISIT_GAP_MS),
    ]);
    assert.equal(visits.length, 1);
  });

  it('never merges different IPs', () => {
    const visits = sessionizeVisits([
      view('ip1', '/', 0),
      view('ip2', '/about', MIN),
    ]);
    assert.equal(visits.length, 2);
  });

  it('sorts unordered input', () => {
    const visits = sessionizeVisits([
      view('ip1', '/trending', 5 * MIN),
      view('ip1', '/', 0),
      view('ip1', '/about', 2 * MIN),
    ]);
    assert.equal(visits.length, 1);
    assert.deepEqual(visits[0].paths, ['/', '/about', '/trending']);
  });

  it('interleaved IPs still group correctly', () => {
    const visits = sessionizeVisits([
      view('ip1', '/', 0),
      view('ip2', '/about', MIN),
      view('ip1', '/chat', 2 * MIN),
      view('ip2', '/trending', 3 * MIN),
    ]);
    assert.equal(visits.length, 2);
    const byIp = new Map(visits.map((v) => [v.hashedIp, v.paths]));
    assert.deepEqual(byIp.get('ip1'), ['/', '/chat']);
    assert.deepEqual(byIp.get('ip2'), ['/about', '/trending']);
  });
});

describe('pageJourneyStats', () => {
  it('marks a single-page visit as a bounce with no onward', () => {
    const stats = pageJourneyStats(sessionizeVisits([view('ip1', '/learn', 0)]));
    assert.equal(stats.length, 1);
    assert.deepEqual(stats[0], {
      path: '/learn',
      views: 1,
      entries: 1,
      exits: 1,
      onward: 0,
      onwardRate: 0,
      bounces: 1,
    });
  });

  it('counts onward navigation on the earlier page only', () => {
    const stats = pageJourneyStats(
      sessionizeVisits([view('ip1', '/', 0), view('ip1', '/about', MIN)])
    );
    const home = stats.find((s) => s.path === '/')!;
    const about = stats.find((s) => s.path === '/about')!;
    assert.equal(home.onward, 1);
    assert.equal(home.onwardRate, 1);
    assert.equal(home.exits, 0);
    assert.equal(about.onward, 0);
    assert.equal(about.exits, 1);
    assert.equal(about.bounces, 0);
  });

  it('does not count a reload of the same path as onward', () => {
    const stats = pageJourneyStats(
      sessionizeVisits([view('ip1', '/learn', 0), view('ip1', '/learn', MIN)])
    );
    const learn = stats.find((s) => s.path === '/learn')!;
    assert.equal(learn.views, 2);
    assert.equal(learn.onward, 0);
    assert.equal(learn.bounces, 1, 'one distinct path is still a bounce');
  });

  it('aggregates across visits and sorts by views', () => {
    const stats = pageJourneyStats(
      sessionizeVisits([
        view('ip1', '/', 0),
        view('ip1', '/about', MIN),
        view('ip2', '/', 60 * MIN),
        view('ip3', '/learn', 120 * MIN),
      ])
    );
    assert.equal(stats[0].path, '/');
    assert.equal(stats[0].views, 2);
    assert.equal(stats[0].entries, 2);
    assert.equal(stats[0].onward, 1);
    assert.equal(stats[0].onwardRate, 0.5);
    assert.equal(stats[0].bounces, 1, 'ip2 saw only the homepage');
  });

  it('a mid-journey page gets onward credit', () => {
    const stats = pageJourneyStats(
      sessionizeVisits([
        view('ip1', '/', 0),
        view('ip1', '/trending', MIN),
        view('ip1', '/agents/foo', 2 * MIN),
      ])
    );
    const trending = stats.find((s) => s.path === '/trending')!;
    assert.equal(trending.onward, 1);
    assert.equal(trending.entries, 0);
    assert.equal(trending.exits, 0);
  });
});
