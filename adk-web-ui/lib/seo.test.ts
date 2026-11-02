import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadOfflineCatalog } from './agent-catalog.ts';
import { loadGuides, type GuideMeta } from './guides.ts';
import { agentJsonLd, buildSitemap, contactJsonLd, examplesJsonLd, guideJsonLd, jsonLdScript } from './seo.ts';

const GUIDE: GuideMeta = {
  slug: 'adk-mcp-toolset',
  title: 'How to connect an MCP server',
  seoTitle: 'MCP guide',
  description: 'Connect one.',
  published: '2026-11-02',
  agents: ['exa_mcp_agent'],
  keywords: ['ADK', 'MCP'],
};

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

  it('lists the guides index, every guide, and /contact', () => {
    const guides = loadGuides();
    const urls = buildSitemap([], BASE, guides).map((entry) => entry.url);

    assert.ok(urls.includes(`${BASE}/guides`));
    assert.ok(urls.includes(`${BASE}/contact`));
    for (const guide of guides) assert.ok(urls.includes(`${BASE}/guides/${guide.slug}`), `missing ${guide.slug}`);
  });

  it('dates a guide by its update, else its publication', () => {
    const entries = buildSitemap([], BASE, [GUIDE, { ...GUIDE, slug: 'b', updated: '2026-12-01' }]);
    const bySlug = (slug: string) => entries.find((entry) => entry.url === `${BASE}/guides/${slug}`);
    assert.equal((bySlug('adk-mcp-toolset')?.lastModified as Date).toISOString().slice(0, 10), '2026-11-02');
    assert.equal((bySlug('b')?.lastModified as Date).toISOString().slice(0, 10), '2026-12-01');
  });

  it('only sets lastModified from a real agent date', () => {
    const [, , , , , dated, undated, bad] = buildSitemap(
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

  it('builds a TechArticle and a Guides breadcrumb trail for a guide', () => {
    const [article, crumbs] = guideJsonLd(GUIDE, BASE);
    assert.equal(article['@type'], 'TechArticle');
    assert.equal(article.url, `${BASE}/guides/adk-mcp-toolset`);
    assert.equal(article.dateModified, '2026-11-02');
    assert.deepEqual(article.mentions?.map((item) => item.url), [`${BASE}/agents/exa_mcp_agent`]);
    assert.deepEqual(
      crumbs.itemListElement.map((item) => [item.position, item.item]),
      [
        [1, BASE],
        [2, `${BASE}/guides`],
        [3, `${BASE}/guides/adk-mcp-toolset`],
      ]
    );
  });

  it('builds a ContactPage, with sameAs only when profiles are configured', () => {
    const page = contactJsonLd(BASE, ['https://www.linkedin.com/in/someone']);
    assert.equal(page['@type'], 'ContactPage');
    assert.equal(page.url, `${BASE}/contact`);
    assert.deepEqual(page.mainEntity.sameAs, ['https://www.linkedin.com/in/someone']);
    assert.ok(!('sameAs' in contactJsonLd(BASE, []).mainEntity));
  });

  it('numbers the examples list from 1', () => {
    const list = examplesJsonLd([{ name: 'a', displayName: 'A' }, { name: 'b', displayName: 'B' }], BASE);
    assert.deepEqual(list.itemListElement.map((item) => item.position), [1, 2]);
  });

  it('escapes < so a description cannot close the script tag', () => {
    assert.ok(!jsonLdScript({ description: '</script><b>' }).includes('</script>'));
  });
});
