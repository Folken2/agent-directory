import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { embedQuery, embedSrc, isLegacyPlaceId } from './embed';

describe('isLegacyPlaceId', () => {
  it('accepts legacy place IDs the Embed API understands', () => {
    assert.equal(isLegacyPlaceId('ChIJKVSOT8OipBIR26pCUTeAhwE'), true);
    assert.equal(isLegacyPlaceId('EiRDYXJyZXIgZGUgbGEgTWFyaW5h'), true);
  });

  it('rejects Places v2 IDs, short and empty values', () => {
    assert.equal(isLegacyPlaceId('places/ChIJKVSOT8OipBIR26pCUTeAhwE'), false);
    assert.equal(isLegacyPlaceId('ChIJshort'), false);
    assert.equal(isLegacyPlaceId(''), false);
    assert.equal(isLegacyPlaceId(undefined), false);
    assert.equal(isLegacyPlaceId(null), false);
  });
});

describe('embedQuery', () => {
  it('prefers a legacy place ID', () => {
    assert.equal(
      embedQuery({ placeId: 'ChIJKVSOT8OipBIR26pCUTeAhwE', name: 'Café Fargo' }),
      'place_id:ChIJKVSOT8OipBIR26pCUTeAhwE',
    );
  });

  it('falls back to name and address when the ID is not legacy', () => {
    assert.equal(
      embedQuery({ placeId: 'places/abc', name: 'Café Fargo', address: 'Carrer de la Marina, 288' }),
      'Café Fargo, Carrer de la Marina, 288',
    );
  });

  it('uses whichever of name or address exists', () => {
    assert.equal(embedQuery({ name: 'Café Fargo' }), 'Café Fargo');
    assert.equal(embedQuery({ address: 'Carrer de la Marina, 288' }), 'Carrer de la Marina, 288');
  });

  it('returns null when there is nothing to search for', () => {
    assert.equal(embedQuery({}), null);
    assert.equal(embedQuery({ name: '  ', address: '' }), null);
  });
});

describe('embedSrc', () => {
  it('builds a place embed URL with key and query', () => {
    const url = new URL(embedSrc('k123', 'place_id:ChIJKVSOT8OipBIR26pCUTeAhwE'));
    assert.equal(url.origin + url.pathname, 'https://www.google.com/maps/embed/v1/place');
    assert.equal(url.searchParams.get('key'), 'k123');
    assert.equal(url.searchParams.get('q'), 'place_id:ChIJKVSOT8OipBIR26pCUTeAhwE');
    assert.equal(url.searchParams.has('context'), false);
  });

  it('adds the widget context token when given', () => {
    const url = new URL(embedSrc('k123', 'Café Fargo', 'tok'));
    assert.equal(url.searchParams.get('context'), 'tok');
  });
});
