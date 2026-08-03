import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTimelineRange,
  timelineRangeDays,
} from './timeline-range.ts';
import {
  analyticsOpsEmails,
  isAnalyticsOpsEmail,
} from './ops-access.ts';

describe('parseTimelineRange', () => {
  it('defaults to 30', () => {
    assert.equal(parseTimelineRange(undefined), '30');
    assert.equal(parseTimelineRange(null), '30');
    assert.equal(parseTimelineRange('nope'), '30');
  });

  it('accepts 90 and all', () => {
    assert.equal(parseTimelineRange('90'), '90');
    assert.equal(parseTimelineRange('all'), 'all');
  });
});

describe('timelineRangeDays', () => {
  it('maps fixed windows and all', () => {
    assert.equal(timelineRangeDays('30'), 30);
    assert.equal(timelineRangeDays('90'), 90);
    assert.equal(timelineRangeDays('all'), null);
  });
});

describe('isAnalyticsOpsEmail', () => {
  it('matches default allowlist', () => {
    assert.equal(isAnalyticsOpsEmail('folkenai21@gmail.com', undefined), true);
    assert.equal(isAnalyticsOpsEmail('FOLKENAI21@GMAIL.COM'), true);
    assert.equal(isAnalyticsOpsEmail('other@example.com'), false);
    assert.equal(isAnalyticsOpsEmail(null), false);
  });

  it('parses comma-separated env', () => {
    assert.deepEqual(analyticsOpsEmails('a@x.com, b@y.com'), [
      'a@x.com',
      'b@y.com',
    ]);
    assert.equal(isAnalyticsOpsEmail('b@y.com', 'a@x.com, b@y.com'), true);
  });
});
