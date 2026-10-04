import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dataUrlToBytes } from './data-url.ts';

describe('dataUrlToBytes', () => {
  it('decodes a base64 data URL', () => {
    const out = dataUrlToBytes('data:application/zip;base64,UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==');
    assert.ok(out);
    assert.equal(out.mimeType, 'application/zip');
    assert.equal(out.bytes.length, 22);
    assert.deepEqual([...out.bytes.slice(0, 4)], [0x50, 0x4b, 5, 6]);
  });

  it('returns null for anything else', () => {
    assert.equal(dataUrlToBytes('https://x.test/a.zip'), null);
    assert.equal(dataUrlToBytes('data:text/plain,hello'), null);
    assert.equal(dataUrlToBytes('data:application/zip;base64,%%%'), null);
  });
});
