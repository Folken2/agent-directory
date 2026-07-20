import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseGuideDocument, extractGuideFence } from './parse.ts';

const valid = {
  shape: 'neighborhood',
  lead: 'Gràcia is great for cafés.',
  sections: [{ id: 's1', title: 'Cafés', placeIds: ['p1'] }],
  places: [{ id: 'p1', name: 'Café Cometa', address: 'Carrer x', rating: 4.6, summary: 'Quiet specialty coffee.' }],
  sources: [{ title: 'Timeout', url: 'https://example.com' }],
};

describe('parseGuideDocument', () => {
  it('accepts a valid neighborhood document', () => {
    const doc = parseGuideDocument(valid);
    assert.ok(doc);
    assert.equal(doc!.places[0].name, 'Café Cometa');
  });

  it('rejects missing places', () => {
    assert.equal(parseGuideDocument({ ...valid, places: [] }), null);
  });

  it('rejects unknown shape', () => {
    assert.equal(parseGuideDocument({ ...valid, shape: 'nope' }), null);
  });

  it('rejects section placeIds that do not exist', () => {
    assert.equal(
      parseGuideDocument({
        ...valid,
        sections: [{ id: 's1', title: 'X', placeIds: ['missing'] }],
      }),
      null,
    );
  });
});

describe('extractGuideFence', () => {
  it('parses ```guidejson fence and returns lead-only display text', () => {
    const text = `Gràcia is great for cafés.\n\n\`\`\`guidejson\n${JSON.stringify(valid)}\n\`\`\`\n`;
    const { document, displayText } = extractGuideFence(text);
    assert.ok(document);
    assert.equal(document!.shape, 'neighborhood');
    assert.match(displayText, /Gràcia/);
    assert.doesNotMatch(displayText, /guidejson/);
  });

  it('returns null document when fence missing', () => {
    const { document, displayText } = extractGuideFence('Just prose');
    assert.equal(document, null);
    assert.equal(displayText, 'Just prose');
  });
});
