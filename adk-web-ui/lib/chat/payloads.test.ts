import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDisplayContent, messagePayloads } from './payloads.ts';

const guide = {
  shape: 'single',
  lead: 'Lead',
  places: [{ id: 'p1', name: 'Cafe' }],
  sections: [{ id: 's1', title: 'Where', placeIds: ['p1'] }],
};
const artifact = { id: 'a', name: 'a.png', type: 'image' as const, url: '/a' };
const capture = { token: 't', places: [], captured_at: 'now' };

describe('getDisplayContent', () => {
  it('unwraps JSON envelopes', () => {
    assert.equal(getDisplayContent('{"response":" hi "}'), 'hi');
    assert.equal(getDisplayContent('{"text":"t"}'), 't');
    assert.equal(getDisplayContent('{"artifacts":[]}'), '');
    assert.equal(getDisplayContent('plain'), 'plain');
    assert.equal(getDisplayContent(null), '');
    assert.equal(getDisplayContent('   '), '');
  });
});

describe('messagePayloads', () => {
  it('orders text, artifacts, maps', () => {
    const p = messagePayloads({ content: 'Hello', artifacts: [artifact], mapsCaptures: [capture] });
    assert.deepEqual(p.map((x) => x.type), ['text', 'artifact', 'maps']);
  });
  it('a valid guide replaces the other payloads', () => {
    const p = messagePayloads({ content: 'Lead', guideDocument: guide, mapsCaptures: [capture] });
    assert.deepEqual(p.map((x) => x.type), ['guide']);
  });
  it('an invalid stored guide falls back to text', () => {
    const p = messagePayloads({ content: 'Hi', guideDocument: { shape: 'nope' } });
    assert.deepEqual(p.map((x) => x.type), ['text']);
  });
  it('empty messages have no payloads', () => {
    assert.deepEqual(messagePayloads({ content: '' }), []);
  });
  it('appends a valid blueprint after the text', () => {
    const blueprint = { name: 'Bp', goal: 'G', agents: [{ name: 'a', role: 'r' }] };
    assert.deepEqual(messagePayloads({ content: 'Hi', blueprint }).map((x) => x.type), ['text', 'blueprint']);
    assert.deepEqual(messagePayloads({ content: 'Hi', blueprint: { name: 'bad' } }).map((x) => x.type), ['text']);
  });
});
