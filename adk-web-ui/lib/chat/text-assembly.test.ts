import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeFinalText, mergeMainThinking, mergeStepText } from './text-assembly.ts';

describe('mergeFinalText', () => {
  it('appends new deltas', () => {
    assert.equal(mergeFinalText('Hello', ' world'), 'Hello world');
    assert.equal(mergeFinalText('', 'Hi'), 'Hi');
  });
  it('replaces with a cumulative re-send', () => {
    assert.equal(mergeFinalText('Hello', 'Hello world'), 'Hello world');
  });
  it('ignores exact duplicates and already-seen fragments', () => {
    assert.equal(mergeFinalText('Hello world', 'Hello world'), 'Hello world');
    assert.equal(mergeFinalText('Hello world', 'world'), 'Hello world');
  });
  it('treats a long re-emission with the same 50-char prefix as a revision', () => {
    const base = 'x'.repeat(60);
    assert.equal(mergeFinalText(base + 'old tail', base + 'new'), base + 'old tail');
    assert.equal(mergeFinalText(base + 'a', base + 'revised tail'), base + 'revised tail');
  });
});

describe('mergeMainThinking', () => {
  it('follows the same cumulative/duplicate rules', () => {
    assert.equal(mergeMainThinking('', 'a'), 'a');
    assert.equal(mergeMainThinking('ab', 'abc'), 'abc');
    assert.equal(mergeMainThinking('abc', 'b'), 'abc');
    assert.equal(mergeMainThinking('abc', 'd'), 'abcd');
  });
});

describe('mergeStepText', () => {
  it('handles empty, cumulative, duplicate and new text', () => {
    assert.equal(mergeStepText(undefined, 'a'), 'a');
    assert.equal(mergeStepText('a', 'a'), 'a');
    assert.equal(mergeStepText('a', 'ab'), 'ab');
    assert.equal(mergeStepText('abc', 'b'), 'abc');
    assert.equal(mergeStepText('abc', 'x'), 'abcx');
  });
});
