import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { byteaToBuffer } from './bytea.ts';

describe('byteaToBuffer', () => {
  it('accepts what Postgres drivers return for bytea', () => {
    const expected = Buffer.from([0x50, 0x4b, 5, 6]);
    assert.deepEqual(byteaToBuffer(expected), expected);
    assert.deepEqual(byteaToBuffer(new Uint8Array([0x50, 0x4b, 5, 6])), expected);
    assert.deepEqual(byteaToBuffer('\\x504b0506'), expected);
  });

  it('rejects anything else', () => {
    assert.throws(() => byteaToBuffer('504b'), TypeError);
    assert.throws(() => byteaToBuffer(12), TypeError);
  });
});
