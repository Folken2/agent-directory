import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { configuredEmail, configuredUrl } from './site.ts';

describe('contact config', () => {
  it('accepts only a plain email address', () => {
    assert.equal(configuredEmail(' me@example.com '), 'me@example.com');
    assert.equal(configuredEmail(undefined), null);
    assert.equal(configuredEmail('not an email'), null);
    assert.equal(configuredEmail('me@example.com?bcc=other@example.com'), null);
  });

  it('accepts only a valid URL', () => {
    assert.equal(configuredUrl('https://github.com/someone'), 'https://github.com/someone');
    assert.equal(configuredUrl('github.com/someone'), null);
    assert.equal(configuredUrl(''), null);
  });
});
