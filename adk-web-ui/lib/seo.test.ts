import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadOfflineCatalog } from './agent-catalog.ts';
import { agentJsonLd, buildSitemap, examplesJsonLd, jsonLdScript } from './seo.ts';

const BASE = 'https://example.test';

describe('buildSitemap', () => {
  it('lists every catalog agent page, without the /chat app shell', () => {
    const catalog = loadOfflineCatalog();
    const urls = buildSitemap(catalog, BASE).map((entry) => entry.url);

    assert.ok(catalog.length > 0);
    for (const agent of catalog) {
      assert.ok(urls.includes(`${BASE}/agents/${encodeURIComponent(agent.name)}`), `missing ${agent.name}`);
    }
    assert.ok(urls.includes(BASE));
    assert.ok(!urls.some((url) => url.includes('/chat')));
  });

  it('only sets lastModified from a real agent date', () => {
    const [, , , dated, undated, bad] = buildSitemap(
      [
        { name: 'a', displayName: 'A', description: '', tools: [], lastUpdated: '2026-01-15' },
        { name: 'b', displayName: 'B', description: '', tools: [] },
        { name: 'c', displayName: 'C', description: '', tools: [], lastUpdated: 'not a date' },
      ],
      BASE
    );
    assert.ok(dated.lastModified instanceof Date);
    assert.equal(undated.lastModified, undefined);
    assert.equal(bad.lastModified, undefined);
  });
});

describe('JSON-LD', () => {
  it('builds an app entry and a breadcrumb trail for an agent', () => {
    const [app, crumbs] = agentJsonLd(
      { name: 'trip_planner', displayName: 'Trip Planner', description: 'Plans trips', tools: [], author: 'Ada' },
      BASE,
      { label: 'Examples', href: '/examples' }
    );
    assert.equal(app['@type'], 'SoftwareApplication');
    assert.equal(app.url, `${BASE}/agents/trip_planner`);
    assert.deepEqual(app.author, { '@type': 'Person', name: 'Ada' });
    assert.deepEqual(
      crumbs.itemListElement.map((item) => item.item),
      [BASE, `${BASE}/examples`, `${BASE}/agents/trip_planner`]
    );
  });

  it('numbers the examples list from 1', () => {
    const list = examplesJsonLd([{ name: 'a', displayName: 'A' }, { name: 'b', displayName: 'B' }], BASE);
    assert.deepEqual(list.itemListElement.map((item) => item.position), [1, 2]);
  });

  it('escapes < so a description cannot close the script tag', () => {
    assert.ok(!jsonLdScript({ description: '</script><b>' }).includes('</script>'));
  });
});
