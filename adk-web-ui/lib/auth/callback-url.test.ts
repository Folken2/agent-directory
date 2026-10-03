import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { safeCallbackPath, signInErrorMessage } from './callback-url.ts';

describe('safeCallbackPath', () => {
  it('keeps same-site paths with their query', () => {
    assert.equal(safeCallbackPath('/me/sessions'), '/me/sessions');
    assert.equal(safeCallbackPath('/chat?agent=x'), '/chat?agent=x');
    assert.equal(safeCallbackPath(['/settings', '/other']), '/settings');
  });

  it('falls back for missing, absolute or protocol-relative values', () => {
    assert.equal(safeCallbackPath(undefined), '/');
    assert.equal(safeCallbackPath(''), '/');
    assert.equal(safeCallbackPath('https://evil.example/'), '/');
    assert.equal(safeCallbackPath('//evil.example'), '/');
    assert.equal(safeCallbackPath('/\\evil.example'), '/');
    assert.equal(safeCallbackPath('javascript:alert(1)'), '/');
  });

  it('does not loop back to the sign-in page', () => {
    assert.equal(safeCallbackPath('/auth/signin?callbackUrl=/x'), '/');
  });
});

describe('signInErrorMessage', () => {
  it('is null without an error and plain text otherwise', () => {
    assert.equal(signInErrorMessage(undefined), null);
    assert.match(signInErrorMessage('AccessDenied') ?? '', /denied/);
    assert.match(signInErrorMessage('OAuthCallbackError') ?? '', /try again/);
  });
});
