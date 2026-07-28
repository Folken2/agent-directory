import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { countryFlag, countryName } from './countries.ts';

describe('countryName', () => {
  it('resolves ISO codes to readable names', () => {
    assert.equal(countryName('US'), 'United States');
    assert.equal(countryName('de'), 'Germany');
  });

  it('labels missing geo as Unknown', () => {
    assert.equal(countryName('ZZ'), 'Unknown');
    assert.equal(countryName(null), 'Unknown');
    assert.equal(countryName(''), 'Unknown');
  });

  it('passes through codes it cannot resolve', () => {
    assert.equal(countryName('XK1'), 'XK1');
  });
});

describe('countryFlag', () => {
  it('builds regional indicator flags', () => {
    assert.equal(countryFlag('FR'), '🇫🇷');
    assert.equal(countryFlag('jp'), '🇯🇵');
  });

  it('falls back to a globe for unknown geo', () => {
    assert.equal(countryFlag('ZZ'), '🌐');
    assert.equal(countryFlag(undefined), '🌐');
  });
});
