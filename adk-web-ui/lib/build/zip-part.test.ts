import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { partBytes } from './zip-part.ts';

const EOCD = Buffer.concat([Buffer.from([0x50, 0x4b, 5, 6]), Buffer.alloc(18)]);

describe('partBytes', () => {
  it('decodes ADK url-safe base64 in either casing', () => {
    assert.deepEqual(partBytes({ inlineData: { mimeType: 'application/zip', data: EOCD.toString('base64url') } }), EOCD);
    assert.deepEqual(partBytes({ inline_data: { mime_type: 'application/zip', data: EOCD.toString('base64') } }), EOCD);
  });

  it('returns null when there are no bytes', () => {
    assert.equal(partBytes(null), null);
    assert.equal(partBytes({ text: 'x' }), null);
    assert.equal(partBytes({ inlineData: { data: '' } }), null);
  });
});
