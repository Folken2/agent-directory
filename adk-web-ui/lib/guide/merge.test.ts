import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeGuideWithCaptures } from './merge.ts';
import type { GuideDocument } from './types.ts';

const doc: GuideDocument = {
  shape: 'neighborhood',
  lead: 'Hi',
  sections: [{ id: 's1', title: 'Cafés', placeIds: ['p1', 'p2'] }],
  places: [
    { id: 'p1', name: 'Café Cometa' },
    { id: 'p2', name: 'Other', mapsCaptureIndex: 1 },
  ],
};

describe('mergeGuideWithCaptures', () => {
  it('fills placeId/mapsUrl from title match', () => {
    const merged = mergeGuideWithCaptures(doc, [
      {
        token: 'tok0',
        captured_at: 't0',
        places: [{ place_id: 'ChIJabc', title: 'Café Cometa', uri: 'https://maps.google.com/?cid=1' }],
      },
    ]);
    assert.equal(merged.places[0].placeId, 'ChIJabc');
    assert.equal(merged.places[0].mapsUrl, 'https://maps.google.com/?cid=1');
    assert.equal(merged.places[0].mapsCaptureIndex, 0);
  });

  it('honors explicit mapsCaptureIndex', () => {
    const merged = mergeGuideWithCaptures(doc, [
      { token: 'a', captured_at: 't0', places: [{ place_id: 'x', title: 'Nope', uri: null }] },
      {
        token: 'b',
        captured_at: 't1',
        places: [{ place_id: 'ChIJother', title: 'Other', uri: 'https://maps.google.com/?cid=2' }],
      },
    ]);
    assert.equal(merged.places[1].placeId, 'ChIJother');
  });
});
