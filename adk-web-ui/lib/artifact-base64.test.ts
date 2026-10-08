import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toStandardBase64 } from './artifact-base64.ts';

describe('toStandardBase64', () => {
  it('turns URL-safe base64 from ADK into bytes a data: URL decodes', () => {
    const bytes = Buffer.from([0xfb, 0xff, 0xbf, 0x00, 0x3e]);
    const urlSafe = bytes.toString('base64url');
    assert.match(urlSafe, /[-_]/);
    const standard = toStandardBase64(urlSafe);
    assert.match(standard, /^[A-Za-z0-9+/]+={0,2}$/);
    assert.equal(standard.length % 4, 0);
    assert.deepEqual(Buffer.from(standard, 'base64'), bytes);
  });

  it('leaves standard base64 unchanged', () => {
    const standard = Buffer.from('hello world').toString('base64');
    assert.equal(toStandardBase64(standard), standard);
  });
});
