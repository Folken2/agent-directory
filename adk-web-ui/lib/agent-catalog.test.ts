import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearLastGoodAgentsCache,
  getLastGoodAgents,
  loadCatalogFromSnapshot,
  loadOfflineCatalog,
  resolveFallbackAgents,
  setLastGoodAgents,
} from './agent-catalog.ts';

describe('agent-catalog cold-start fallbacks', () => {
  beforeEach(() => {
    clearLastGoodAgentsCache();
  });

  it('loads a non-empty offline catalog without the stale image_agent singleton', () => {
    const catalog = loadOfflineCatalog();
    assert.ok(catalog.length >= 8, `expected >= 8 agents, got ${catalog.length}`);
    assert.ok(
      catalog.every((agent) => agent.name !== 'image_agent'),
      'must not include stale image_agent'
    );
    assert.ok(
      catalog.some((agent) => agent.name === 'image_generation_agent'),
      'expected image_generation_agent in catalog'
    );
  });

  it('snapshot contains the same agent names as the offline catalog when disk is present', () => {
    const fromSnapshot = loadCatalogFromSnapshot().map((a) => a.name).sort();
    const offline = loadOfflineCatalog().map((a) => a.name).sort();
    assert.deepEqual(fromSnapshot, offline);
  });

  it('prefers last-good cache over catalog', () => {
    setLastGoodAgents([
      {
        name: 'cached_only_agent',
        displayName: 'Cached Only',
        description: 'From last successful live list',
        tools: [],
        tags: [],
        useCases: [],
        samplePrompts: [],
      },
    ]);

    const { agents, source } = resolveFallbackAgents();
    assert.equal(source, 'cache');
    assert.equal(agents.length, 1);
    assert.equal(agents[0]?.name, 'cached_only_agent');
    assert.equal(getLastGoodAgents()?.[0]?.name, 'cached_only_agent');
  });

  it('falls back to catalog when cache is empty', () => {
    const { agents, source } = resolveFallbackAgents();
    assert.equal(source, 'catalog');
    assert.ok(agents.length >= 8);
  });
});
