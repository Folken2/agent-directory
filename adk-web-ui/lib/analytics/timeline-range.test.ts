import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTimelineRange,
  timelineRangeDays,
} from './timeline-range.ts';

describe('parseTimelineRange', () => {
  it('defaults to 30', () => {
    assert.equal(parseTimelineRange(undefined), '30');
    assert.equal(parseTimelineRange(null), '30');
    assert.equal(parseTimelineRange('nope'), '30');
  });

  it('accepts 7, 90 and all', () => {
    assert.equal(parseTimelineRange('7'), '7');
    assert.equal(parseTimelineRange('90'), '90');
    assert.equal(parseTimelineRange('all'), 'all');
  });
});

describe('timelineRangeDays', () => {
  it('maps fixed windows and all', () => {
    assert.equal(timelineRangeDays('7'), 7);
    assert.equal(timelineRangeDays('30'), 30);
    assert.equal(timelineRangeDays('90'), 90);
    assert.equal(timelineRangeDays('all'), null);
  });
});
