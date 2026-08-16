import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { laterIso, parseAgentSlugs, toSignedInUserRow } from './signed-in-users';

describe('laterIso', () => {
  it('returns the later of two timestamps', () => {
    assert.equal(
      laterIso('2026-08-01T10:00:00.000Z', '2026-08-10T10:00:00.000Z'),
      '2026-08-10T10:00:00.000Z'
    );
  });

  it('returns the non-null value when one is missing', () => {
    assert.equal(laterIso('2026-08-01T10:00:00.000Z', null), '2026-08-01T10:00:00.000Z');
    assert.equal(laterIso(null, '2026-08-10T10:00:00.000Z'), '2026-08-10T10:00:00.000Z');
    assert.equal(laterIso(null, null), null);
  });
});

describe('parseAgentSlugs', () => {
  it('splits a comma-separated string and drops blanks', () => {
    assert.deepEqual(parseAgentSlugs('local-guide,image-gen,'), [
      'local-guide',
      'image-gen',
    ]);
  });

  it('accepts a postgres text array', () => {
    assert.deepEqual(parseAgentSlugs(['local-guide', 'image-gen']), [
      'local-guide',
      'image-gen',
    ]);
  });

  it('returns empty for nullish values', () => {
    assert.deepEqual(parseAgentSlugs(null), []);
    assert.deepEqual(parseAgentSlugs(undefined), []);
    assert.deepEqual(parseAgentSlugs(''), []);
  });
});

describe('toSignedInUserRow', () => {
  it('maps a signed-in user with usage onto last-active and counts', () => {
    const row = toSignedInUserRow({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'ada@example.com',
      name: 'Ada',
      image: 'https://example.com/ada.png',
      created_at: '2026-07-01T00:00:00.000Z',
      page_views: '12',
      runs: '4',
      errors: '1',
      agents_used: '2',
      agent_slugs: 'local-guide,image-gen',
      last_run_at: '2026-08-10T09:00:00.000Z',
      last_view_at: '2026-08-12T11:00:00.000Z',
    });

    assert.equal(row.email, 'ada@example.com');
    assert.equal(row.pageViews, 12);
    assert.equal(row.runs, 4);
    assert.equal(row.errors, 1);
    assert.equal(row.agentsUsed, 2);
    assert.deepEqual(row.agentSlugs, ['local-guide', 'image-gen']);
    assert.equal(row.lastActiveAt, '2026-08-12T11:00:00.000Z');
    assert.equal(row.signedUpAt, '2026-07-01T00:00:00.000Z');
  });

  it('keeps a signed-in user with no usage, lastActive null', () => {
    const row = toSignedInUserRow({
      id: '22222222-2222-4222-8222-222222222222',
      email: 'new@example.com',
      name: 'New',
      image: null,
      created_at: new Date('2026-08-16T08:00:00.000Z'),
      page_views: 0,
      runs: 0,
      errors: 0,
      agents_used: 0,
      agent_slugs: null,
      last_run_at: null,
      last_view_at: null,
    });

    assert.equal(row.pageViews, 0);
    assert.equal(row.runs, 0);
    assert.deepEqual(row.agentSlugs, []);
    assert.equal(row.lastActiveAt, null);
    assert.equal(row.image, null);
    assert.equal(row.signedUpAt, '2026-08-16T08:00:00.000Z');
  });
});
