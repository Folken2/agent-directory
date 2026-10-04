import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDisplayContent, messagePayloads } from './payloads.ts';
import { BUILD } from '../build/test-fixtures.ts';

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
  it('renders the build card and drops the duplicate zip artifact', () => {
    const zip = { id: 'research-summarizer.zip', name: 'research-summarizer.zip', type: 'file' as const, url: 'data:application/zip;base64,UEs=' };
    const p = messagePayloads({ content: 'Packaged.', artifacts: [zip, artifact], build: BUILD });
    assert.deepEqual(p.map((x) => x.type), ['text', 'build', 'artifact']);
    const listed = p.find((x) => x.type === 'artifact');
    assert.deepEqual(listed?.type === 'artifact' ? listed.artifacts.map((a) => a.name) : null, ['a.png']);
  });
  it('omits the artifact payload when the zip was the only artifact', () => {
    const zip = { id: 'z', name: 'research-summarizer.zip', type: 'file' as const, url: 'data:application/zip;base64,UEs=' };
    assert.deepEqual(messagePayloads({ content: 'Packaged.', artifacts: [zip], build: BUILD }).map((x) => x.type), ['text', 'build']);
  });
  it('ignores an invalid stored build and keeps the artifacts', () => {
    const zip = { id: 'z', name: 'research-summarizer.zip', type: 'file' as const, url: 'data:application/zip;base64,UEs=' };
    assert.deepEqual(messagePayloads({ content: 'Hi', artifacts: [zip], build: { name: 'bad' } }).map((x) => x.type), ['text', 'artifact']);
  });
});
