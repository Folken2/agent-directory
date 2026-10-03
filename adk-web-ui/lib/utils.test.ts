import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cn } from './utils.ts';

describe('cn', () => {
  it('keeps a type-scale class next to a text colour', () => {
    assert.equal(cn('text-label-small', 'text-md-on-primary-container'), 'text-label-small text-md-on-primary-container');
    assert.equal(cn('text-label-medium', 'text-[var(--chart-good-text)]'), 'text-label-medium text-[var(--chart-good-text)]');
  });

  it('still lets a later font size replace an earlier one', () => {
    assert.equal(cn('text-label-small', 'text-body-large'), 'text-body-large');
    assert.equal(cn('text-body-medium', 'text-sm'), 'text-sm');
  });
});
